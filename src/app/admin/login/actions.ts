"use server";

// Admin sign-in actions: email-first, then EITHER a magic link OR (once an
// admin has set one) a password field — see src/lib/admin/loginMethod.ts for
// the decision table and the anti-enumeration property it's built around.
//
// checkAdminLoginMethodAction is the single entry point for step 1 (email
// only). It always ends in one of two client-visible states:
//   - { sent: true }              — a magic link may or may not have
//                                    actually been emailed; the two cases
//                                    that reach this state ("not allowlisted"
//                                    and "allowlisted, no password yet") are
//                                    NOT distinguishable from the response,
//                                    by design (see below).
//   - { passwordMode: true, ... } — only for a real allowlisted admin who
//                                    has already set a password. Reveals a
//                                    password field. This IS a distinct,
//                                    visible response — the founder's spec
//                                    for this feature explicitly calls for
//                                    progressive disclosure here, so this
//                                    one distinction is intentional, not an
//                                    enumeration leak. What must never leak
//                                    is "not allowlisted" vs. "allowlisted
//                                    but no password set", which is exactly
//                                    what collapsing both into { sent: true }
//                                    prevents.
//
// signInAdminWithPasswordAction is step 2 for the password branch, calling
// supabase.auth.signInWithPassword() directly — no re-implementation of
// Supabase's own credential check. Either sign-in method lands on the exact
// same kind of session, so requireAdminSession() (src/lib/admin/devAuth.ts)
// authorizes both identically; this file never touches `profiles` itself.

import { redirect } from "next/navigation";

import { isEmailAllowlistedForAdmin } from "@/lib/admin/allowlist";
import { decideAdminLoginMode } from "@/lib/admin/loginMethod";
import { getAdminPasswordSet } from "@/lib/admin/passwordStatus";
import { currentOrigin } from "@/lib/studio/requestOrigin";
import { createClient } from "@/lib/supabase/server";

export interface AdminLoginState {
  error?: string;
  sent?: boolean;
  /** Reveal the password field, prefilled for this email. */
  passwordMode?: boolean;
  email?: string;
}

function isPlausibleEmail(value: string): boolean {
  // Deliberately loose — Supabase itself is the real validator. This just
  // filters out empty/obviously-malformed input before making a network
  // call.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Step 1: email only. Decides magic-link vs. password per
 * decideAdminLoginMode(), and — for the magic-link branch — actually sends
 * it (or silently does nothing for a non-allowlisted address), reusing the
 * exact signInWithOtp() call the original single-step flow used.
 *
 * PREVIOUS BUG (found in QA, fixed in the original flow, preserved here):
 * `shouldCreateUser` must stay conditional on the allowlist, never a bare
 * default-true — see git history on this file for the incident. `allowlisted`
 * below plays that same role.
 */
export async function checkAdminLoginMethodAction(
  _prevState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!isPlausibleEmail(email)) {
    return { error: "Enter a valid email address." };
  }

  const allowlisted = isEmailAllowlistedForAdmin(email);
  // Only worth a lookup at all when the address could possibly matter —
  // skips a service-role round trip for the common "not staff" case, and
  // more importantly keeps the two "magic-link" causes symmetric: a
  // non-allowlisted email never even queries `profiles`.
  const passwordSet = allowlisted ? await getAdminPasswordSet(email) : false;

  const mode = decideAdminLoginMode({ allowlisted, passwordSet });

  if (mode === "password") {
    return { passwordMode: true, email };
  }

  const origin = await currentOrigin();
  const supabase = await createClient();

  await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: allowlisted,
      // Lands on the forced password-setup page rather than /admin directly
      // — this is always this admin's first successful sign-in (no password
      // set yet is exactly the condition that put us in this branch).
      emailRedirectTo: `${origin}/auth/confirm?next=/admin/set-password`,
    },
  });

  // Deliberately ignoring the result (success, "signups not allowed" error,
  // rate limit, anything) — surfacing any distinction here is the
  // enumeration leak described above. An allowlisted address gets a real
  // email; everyone else sees the identical "check your inbox" state and
  // nothing arrives.
  return { sent: true };
}

/**
 * Step 2 (password branch only): a real credential check via Supabase Auth
 * itself. Deliberately generic on failure — "incorrect email or password",
 * never "no such account" vs. "wrong password" — so a visitor who reached
 * this form (already only possible for a real allowlisted admin with a
 * password set, per checkAdminLoginMethodAction) can't use failed attempts
 * to learn anything more.
 */
export async function signInAdminWithPasswordAction(
  _prevState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!password) {
    return { passwordMode: true, email, error: "Enter your password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { passwordMode: true, email, error: "Incorrect email or password." };
  }

  // requireAdminSession() (src/lib/admin/devAuth.ts) re-verifies the
  // allowlist/role/password_set from scratch on the very next request — a
  // password-authenticated session gets no special trust here.
  redirect("/admin");
}

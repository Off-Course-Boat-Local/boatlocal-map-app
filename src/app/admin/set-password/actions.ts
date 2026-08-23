"use server";

// Forced "set your password" step for an admin who signed in via magic link
// and has never set one (src/lib/admin/devAuth.ts's requireAdminSession()
// redirects here whenever `passwordSet` is false). See that file's header
// for how this fits the three-layer auth model.
//
// Deliberately re-checks the session itself (getAdminSession(), not
// requireAdminSession() — see set-password/page.tsx's comment on why) rather
// than trusting that only requireAdminSession()'s redirect could have landed
// someone here: a Server Action is a public POST endpoint regardless of
// what page renders the form that calls it (same rule stated in devAuth.ts).
//
// The raw password itself only ever passes through
// supabase.auth.updateUser({ password }) below — never logged, stored, or
// inspected by this app beyond that one call, per the founder's explicit
// instruction.

import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/admin/devAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface SetAdminPasswordState {
  error?: string;
}

const MIN_PASSWORD_LENGTH = 8;

export async function setAdminPasswordAction(
  _prevState: SetAdminPasswordState,
  formData: FormData,
): Promise<SetAdminPasswordState> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  if (session.passwordSet) {
    // Already done (e.g. a stale tab re-submitting, or direct navigation
    // back here after finishing) — nothing left to do.
    redirect("/admin");
  }

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Choose a password with at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();
  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    return { error: "Couldn't set your password. Please try again." };
  }

  // Service-role client, deliberately: password_set is a privileged column
  // (supabase/migrations/20260823160000_admin_password_set.sql) that this
  // admin's own session is not allowed to write via RLS — same pattern as
  // devAuth.ts's allowlisted-first-sign-in profile insert. Targets `id`
  // (not email) so this can never touch the wrong row even if two profiles
  // somehow shared an email string.
  const admin = createAdminClient();
  const { error: flagError } = await admin
    .from("profiles")
    .update({ password_set: true })
    .eq("id", session.id);

  if (flagError) {
    // The Supabase Auth password itself is already set at this point — only
    // our own bookkeeping flag failed to write. Report it as a retryable
    // error rather than silently redirecting into /admin, since
    // requireAdminSession() would just bounce them straight back here
    // anyway (passwordSet still reads false) — re-submitting this same form
    // safely re-runs updateUser() with the same password and retries the
    // flag flip.
    return { error: "Password set, but we couldn't finish setup. Please try again." };
  }

  redirect("/admin");
}

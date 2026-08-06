"use server";

// Sends an Admin magic-link sign-in email.
//
// Unlike Studio (src/lib/studio/actions.ts), which hardcodes
// `shouldCreateUser: false` because a guide/company account only ever
// exists after the invite flow creates it, Admin's own design has no
// pre-provisioning step — an allowlisted address's auth.users row is
// created on its *first* successful sign-in (see
// src/lib/admin/devAuth.ts's resolveAdminSession()). So `shouldCreateUser`
// has to be conditional here, not a hardcoded false.
//
// PREVIOUS BUG (found in QA, fixed here): this used to omit
// `shouldCreateUser` entirely, which defaults to true — so ANY email
// address, allowlisted or not, would get a brand-new Supabase auth user
// created and a real magic-link email sent. That's an abuse vector (spam
// an arbitrary inbox, litter auth.users with permanently orphaned
// non-admin accounts), even though the allowlist check at verification
// time correctly still refused those accounts real Admin access.
//
// The fix checks the allowlist internally, but the RESPONSE is identical
// either way — every code path below ends at the same redirect, ignoring
// whatever Supabase returns. Branching the response on allowlist status
// (e.g. a distinct error for "not allowed" here, before the email is even
// sent) would leak "is this address on the allowlist?" to whoever controls
// that inbox, which is exactly what the original design comment was
// (correctly) protecting against — that part was right, only the
// shouldCreateUser value was wrong.

import { redirect } from "next/navigation";

import { isEmailAllowlistedForAdmin } from "@/lib/admin/allowlist";
import { currentOrigin } from "@/lib/studio/requestOrigin";
import { createClient } from "@/lib/supabase/server";

function isPlausibleEmail(value: string): boolean {
  // Deliberately loose — Supabase itself is the real validator. This just
  // filters out empty/obviously-malformed input before making a network
  // call.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function sendAdminMagicLink(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();

  if (!isPlausibleEmail(email)) {
    redirect("/admin/login?error=invalid_email");
  }

  const origin = await currentOrigin();
  const supabase = await createClient();

  await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: isEmailAllowlistedForAdmin(email),
      emailRedirectTo: `${origin}/auth/confirm?next=/admin`,
    },
  });

  // Deliberately ignoring the result (success, "signups not allowed"
  // error, rate limit, anything) — surfacing any distinction here is the
  // enumeration leak described above. An allowlisted address gets a real
  // email; everyone else sees the identical "check your inbox" message and
  // nothing arrives.
  redirect("/admin/login?sent=1");
}

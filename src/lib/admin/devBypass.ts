// LOCALHOST-ONLY developer sign-in bypass — founder request, 2026-09-01:
// working across two personal machines plus a remote developer, and wanted
// a one-click way in as Admin locally without knowing/resetting a password
// each time.
//
// THIS IS NOT A FAKE SESSION. Earlier in this project's history there was a
// "DEV AUTH STAND-IN" (git history, src/lib/admin/devAuth.ts's header
// comment) that minted an unsigned, forgeable cookie — deliberately insecure
// because no real auth existed yet. That is NOT what this does. Real
// Supabase Auth exists now, and RLS depends on a real, JWT-verified session
// (see devAuth.ts's resolveAdminSession — it reads supabase.auth.getClaims()
// against the actual signed-in user). A fake/forged AdminSession would get
// past requireAdminSession()'s redirect but leave every RLS-gated data read
// (listCompanies, etc. — see authedClient() in src/lib/data/source.ts)
// silently empty, which is worse than no bypass at all.
//
// So instead this mints a REAL session, using the service-role admin client
// to do exactly what a real magic-link click would: generateLink() creates
// a genuine one-time token for an already-allowlisted admin email, and
// verifyOtp() redeems it immediately server-side, setting real Supabase
// Auth cookies via the request-scoped client. Anyone using this bypass gets
// the exact same authenticated, RLS-respecting session a real login
// produces — this only skips the "open your email and click the link" step.
//
// Triple-gated to non-production:
//   1. NODE_ENV !== "production" checked here, hard — throws otherwise.
//   2. The button that calls this (AdminLoginForm.tsx) only renders when
//      the same check passes (Next.js inlines NODE_ENV in client bundles).
//   3. Vercel's production deployment always sets NODE_ENV=production, so
//      this throws immediately even if someone found the route directly.
// On top of that, devSignInAsAdmin only works for an email already on
// ADMIN_ALLOWED_EMAILS — it cannot sign in as an arbitrary address.

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowlistedForAdmin } from "./allowlist";

/** First allowlisted email, for the button's default target. Empty string if none configured. */
export function firstAllowlistedAdminEmail(): string {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)[0] ?? "";
}

/**
 * Mints and immediately redeems a real magic-link session for an
 * allowlisted admin email. Throws in production, or for a non-allowlisted
 * email — callers should let that throw surface as a normal error, same as
 * any other Server Action failure.
 */
export async function devSignInAsAdmin(email: string): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Developer sign-in is disabled in production.");
  }
  const normalized = email.trim().toLowerCase();
  if (!isEmailAllowlistedForAdmin(normalized)) {
    throw new Error(`${normalized} is not on ADMIN_ALLOWED_EMAILS.`);
  }

  const admin = createAdminClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: normalized,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    throw linkError ?? new Error("Could not generate a sign-in link.");
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyError) throw verifyError;
}

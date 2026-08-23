// Pure "which sign-in method should /admin/login show?" decision, split out
// so it can be unit-tested (see loginMethod.test.ts) without pulling in
// `server-only`-guarded Supabase clients — same reason
// src/lib/admin/allowlist.ts exists as its own file (see that file's header
// comment).
//
// The two inputs this takes are already the two facts the anti-enumeration
// design in src/app/admin/login/actions.ts cares about:
//   - allowlisted: is this email on ADMIN_ALLOWED_EMAILS at all?
//   - passwordSet: does the existing admin profile for this email (if any)
//     have profiles.password_set = true?
//
// This function itself has no anti-enumeration obligation — it's a plain
// decision table. The anti-enumeration property lives one layer up, in how
// the caller reacts to "magic-link": that branch must look identical to the
// caller regardless of *why* it was chosen (not allowlisted vs. allowlisted-
// but-no-password-yet), which is exactly what the "magic-link" mode
// collapses those two cases into.

export type AdminLoginMode = "magic-link" | "password";

export interface AdminLoginModeInput {
  /** isEmailAllowlistedForAdmin(email) — see src/lib/admin/allowlist.ts. */
  allowlisted: boolean;
  /** profiles.password_set for this email's admin profile, or false if none exists yet. */
  passwordSet: boolean;
}

/**
 * "password" only when the address is a real, allowlisted admin who has
 * already set a password. Every other combination — not allowlisted, or
 * allowlisted but never set one — resolves to "magic-link", which must
 * produce an identical client-visible response either way (see
 * checkAdminLoginMethodAction in src/app/admin/login/actions.ts).
 */
export function decideAdminLoginMode({
  allowlisted,
  passwordSet,
}: AdminLoginModeInput): AdminLoginMode {
  return allowlisted && passwordSet ? "password" : "magic-link";
}

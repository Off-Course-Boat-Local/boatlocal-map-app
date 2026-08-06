// Pure ADMIN_ALLOWED_EMAILS parsing, split out of src/lib/admin/devAuth.ts
// specifically so it can be unit-tested (see devAuth.test.ts) without
// pulling in that file's `server-only`-guarded Supabase client imports —
// under Vitest (plain Node, no Next.js "react-server" resolve condition),
// importing a `server-only`-guarded module always throws, guard-condition
// or not, so any test needs to avoid that import graph entirely rather
// than trying to work around it.

/** No env var, or an empty one, means nobody can ever sign in — fail closed. */
export function isEmailAllowlistedForAdmin(email: string): boolean {
  const allowlist = (process.env.ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}

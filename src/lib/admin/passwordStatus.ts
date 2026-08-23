// SERVER-ONLY: looks up whether an allowlisted admin has already set a
// password, from the email alone, before any Supabase Auth session exists
// (the visitor has only typed an email into /admin/login — see
// checkAdminLoginMethodAction in src/app/admin/login/actions.ts). There is
// no session to run an authed query as at that point, so this has to go
// through the service-role admin client, same as devAuth.ts's own
// allowlisted-first-sign-in profile insert.
//
// `import "server-only"` guards against an accidental import from a
// "use client" component bundling the service-role key into a browser
// chunk — same pattern as src/lib/supabase/admin.ts itself.

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * True iff a `profiles` row with role='admin' exists for this email and has
 * password_set = true. False for "no such admin" and "admin exists but
 * hasn't set a password yet" alike — callers must not treat those two
 * differently (see loginMethod.ts's own comment on why that collapse is the
 * point, not an oversight).
 *
 * Email is compared as given (already normalized to lowercase by every
 * caller, mirroring how profiles.email is populated from the Supabase Auth
 * claims email in devAuth.ts's resolveAdminSession()) — no ILIKE, to avoid
 * treating a stray `%`/`_` in user input as a SQL LIKE wildcard.
 */
export async function getAdminPasswordSet(email: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("password_set")
    .eq("role", "admin")
    .eq("email", email)
    .maybeSingle();

  return data?.password_set ?? false;
}

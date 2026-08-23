// Admin auth: real Supabase Auth (magic link) gated by a staff allowlist.
//
// Admin has no invite system — it's Boat Local's own staff, not a
// self-serve product. The only gate is ADMIN_ALLOWED_EMAILS (a comma-
// separated env var, see .env.example): an allowlisted email's first
// successful magic-link verification creates their `profiles` row with
// role='admin'; anyone else is refused outright. Nobody can ever land here
// with a default/unset role as a side effect of merely signing in — a
// `profiles` row is only ever created by the deliberate allowlist check
// below, never implicitly.
//
// The actual sign-in form lives in src/app/admin/login/page.tsx and its
// action (src/app/admin/login/actions.ts): it only ever calls
// `supabase.auth.signInWithOtp()` to send the magic link. The link itself
// is redeemed by src/app/auth/confirm/route.ts (shared with Studio),
// which establishes the Supabase Auth session but deliberately does NOT
// touch `profiles` — this file is what turns "there is a valid Supabase
// session" into "there is (or now is) an admin profile for it", the first
// time a protected Admin page is rendered after redemption.
//
// getAdminSession() / requireAdminSession() keep the exact signatures the
// former DEV AUTH STAND-IN used, so every call site (layouts, pages,
// actions) needed no changes for this swap.
//
// Password sign-in (added on top of magic-link, see src/app/admin/login/)
// changes nothing about the above — signInWithPassword() establishes the
// exact same kind of Supabase Auth session signInWithOtp() does, so
// everything below still applies unchanged. The one addition is
// `password_set` (supabase/migrations/20260823160000_admin_password_set.sql):
// requireAdminSession() forces a not-yet-password'd admin to
// /admin/set-password before it will hand back a session for anything else,
// the same "layer 2 UX convenience, not the only check" way it already
// forces a signed-out visitor to /admin/login — src/app/admin/set-password's
// own page/action still re-check independently rather than trusting this.

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { isEmailAllowlistedForAdmin } from "./allowlist";

export interface AdminSession {
  role: "admin";
  /** auth.users id / profiles.id — needed to target this exact row for the service-role password_set flip. */
  id: string;
  email: string;
  /** See supabase/migrations/20260823160000_admin_password_set.sql. */
  passwordSet: boolean;
}

export { isEmailAllowlistedForAdmin };

type AdminSessionResult =
  // Nobody is signed in at all (no valid Supabase session on this request).
  | { status: "signed-out" }
  // Signed in, but the email is neither an existing admin profile nor on
  // the staff allowlist — refused, not given a default role.
  | { status: "not-authorized" }
  | { status: "ok"; session: AdminSession };

/**
 * Resolves the caller's Admin session from the real, JWT-verified Supabase
 * user for this request (getClaims — never getSession, which only reads
 * local cookie state without revalidating against the Auth server).
 *
 * If a `profiles` row already exists for this user, it must have
 * role='admin' or the caller is refused (a Studio company/guide profile
 * does not grant Admin access). If no row exists yet, this is either this
 * admin's very first successful sign-in (email is allowlisted -> create
 * the row) or someone who isn't Boat Local staff (refused).
 *
 * `profiles` has no self-insert RLS policy by design (nobody can hand
 * themselves a role) — the one, narrow exception is this allowlisted
 * first-sign-in case, which is why it goes through the service-role admin
 * client instead of the request-scoped anon client used for everything
 * else here.
 */
async function resolveAdminSession(): Promise<AdminSessionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub || typeof claims.email !== "string" || !claims.email) {
    return { status: "signed-out" };
  }

  const userId = claims.sub;
  const email = claims.email;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, email, password_set")
    .eq("id", userId)
    .maybeSingle();

  if (profile) {
    return profile.role === "admin"
      ? {
          status: "ok",
          session: {
            role: "admin",
            id: profile.id,
            email: profile.email,
            passwordSet: profile.password_set,
          },
        }
      : { status: "not-authorized" };
  }

  if (!isEmailAllowlistedForAdmin(email)) {
    return { status: "not-authorized" };
  }

  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from("profiles")
    .insert({ id: userId, role: "admin", email })
    .select("id, role, email, password_set")
    .single();

  if (error || !created) {
    // Someone else (a concurrent request) may have just created this same
    // row — refusing here rather than throwing is fine either way, since
    // requireAdminSession() will simply re-check on the next navigation.
    return { status: "not-authorized" };
  }

  return {
    status: "ok",
    session: {
      role: "admin",
      id: created.id,
      email: created.email,
      passwordSet: created.password_set,
    },
  };
}

/** Route Handler / Server Action only — clears the Supabase Auth session. */
export async function destroyAdminSession(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

/**
 * Server Component read of the current session, or null if signed out, not
 * yet authorized, or refused by the allowlist.
 *
 * Unlike requireAdminSession(), this does NOT redirect on `passwordSet ===
 * false` — it hands back the session as-is. src/app/admin/set-password's
 * page needs exactly that: a real, authorized admin session that may or may
 * not have a password yet, without requireAdminSession()'s redirect
 * immediately bouncing it back to the very page it's trying to render.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const result = await resolveAdminSession();
  return result.status === "ok" ? result.session : null;
}

/**
 * Layer 2 of the three-layer auth model (see the layout that calls this):
 * redirects a signed-out visitor to /admin/login, and a signed-in-but-
 * refused visitor to /admin/login with a plain "not authorized" reason
 * (never a generic error) rather than silently bouncing them with no
 * explanation. This is a UX convenience, not the only check — every Server
 * Action under src/app/admin still needs to be safe to call directly,
 * since a "use server" action is effectively a public POST endpoint
 * regardless of what layout wraps its page.
 *
 * Also redirects an authorized-but-`passwordSet: false` admin to
 * /admin/set-password before returning anything — this is what actually
 * forces the "set your password" step for every /admin/(protected) page AND
 * every Server Action that calls this (companyActions.ts, boatTourActions.ts,
 * etc.), not just the page you land on right after the magic link. An admin
 * who has only ever signed in via magic link should not be able to reach any
 * of those merely by knowing the action to call directly.
 */
export async function requireAdminSession(): Promise<AdminSession> {
  const result = await resolveAdminSession();
  if (result.status === "ok") {
    if (!result.session.passwordSet) {
      redirect("/admin/set-password");
    }
    return result.session;
  }
  if (result.status === "not-authorized") {
    redirect("/admin/login?error=not_authorized");
  }
  redirect("/admin/login");
}

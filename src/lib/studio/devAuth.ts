// DEV AUTH STAND-IN
//
// There is no real Supabase project and no real Supabase Auth yet. This
// module (plus src/lib/studio/session.ts for the parts that must also be
// importable from a Client Component, and the two Server Actions in
// ./actions.ts) is the ENTIRE stand-in for it: a fixed dev password
// accepted for any email address, a session serialized into a plain (not
// encrypted, not signed) cookie, and a couple of guard helpers that redirect
// unauthenticated or wrong-role visitors.
//
// When real Supabase Auth exists, only these files need to change:
//   - getDevSession()      -> read `auth.getUser()` / a verified session,
//                              then look up the `profiles` row for role +
//                              company_id (see supabase/migrations
//                              /20260805063611_rls_policies.sql).
//   - persistDevSession()/
//     clearDevSession()    -> Supabase's own cookie-based session helpers
//                              (`@supabase/ssr`) already do this.
//   - actorFromSession()   -> stays almost identical; it only maps a
//                              {role, companyId, guideId} shape to
//                              StudioActor, which does not change.
// No page or layout under src/app/studio/ should need to change at all —
// they only ever call getDevSession()/requireDevSession() and
// actorFromSession(), never touch the cookie directly.
//
// Kept deliberately dumb: the cookie is a URI-encoded JSON blob, readable by
// anyone with access to the cookie jar. That is fine for a dev stand-in
// (nothing behind it is real data) and is exactly why every data-access
// function in src/lib/data/source.ts re-checks the actor's permissions
// itself rather than trusting the caller — the same posture RLS will
// enforce for real later.
//
// SERVER-ONLY: this file imports `next/headers` and `next/navigation`, so it
// must never be imported from a Client Component (Next.js's bundler will
// refuse the build if it is). LoginForm.tsx needs DEV_LOGIN_PASSWORD for its
// sign-in hint — it imports that from ./session instead, which is exactly
// why the pure/session-shape pieces live there and not here.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  serializeSession,
  parseSessionCookie,
  type DevSession,
} from "./session";

export {
  SESSION_COOKIE_NAME,
  DEV_LOGIN_PASSWORD,
  serializeSession,
  parseSessionCookie,
  actorFromSession,
  type StudioRole,
  type DevSession,
} from "./session";

/** Reads the current session, if any. Safe to call from any Server Component. */
export async function getDevSession(): Promise<DevSession | null> {
  const store = await cookies();
  return parseSessionCookie(store.get(SESSION_COOKIE_NAME)?.value);
}

/**
 * Belt-and-braces layer #2 (layout/page level) from the routing research
 * notes: redirects to /studio/login if there is no session. Layer #1
 * (src/proxy.ts) is a coarse pre-render check; layer #3 is every Server
 * Action re-checking for itself (see src/lib/studio/actions.ts).
 */
export async function requireDevSession(): Promise<DevSession> {
  const session = await getDevSession();
  if (!session) {
    redirect("/studio/login");
  }
  return session;
}

/** Redirects away (to the Dashboard) unless the session is a "company" actor. Use at the top of company-only pages: Branding, Guides, Boat tours, Campaign, Report. */
export function requireCompanyRole(
  session: DevSession,
): asserts session is Extract<DevSession, { role: "company" }> {
  if (session.role !== "company") {
    redirect("/studio");
  }
}

/** Redirects away (to the Dashboard) unless the session is a "guide" actor. Use at the top of guide-only pages: Link & QR / Stats. */
export function requireGuideRole(
  session: DevSession,
): asserts session is Extract<DevSession, { role: "guide" }> {
  if (session.role !== "guide") {
    redirect("/studio");
  }
}

/**
 * Sets the session cookie. Can only be called from a Server Action or Route
 * Handler (see src/lib/studio/actions.ts) — Next.js does not allow setting
 * cookies during a Server Component's render.
 */
export async function persistDevSession(session: DevSession): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, serializeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Clears the session cookie. Same Server Action / Route Handler restriction as persistDevSession. */
export async function clearDevSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

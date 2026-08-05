// DEV AUTH STAND-IN
//
// No real auth backend exists yet — no Supabase Auth, no user table, no
// password hashing. This module is a deliberately minimal, insecure
// stand-in so the Admin app shell can be built, demoed and tested today.
// It accepts ANY email address paired with a single shared dev password
// (from an env var, with a documented placeholder default) and mints a
// base64-encoded, unsigned cookie carrying the role.
//
// This is NOT secure. The cookie is trivially forgeable (it is base64, not
// signed or encrypted) — that is acceptable ONLY because there is no real
// data behind it yet. Do not copy this pattern for anything that touches
// real user data.
//
// Swapping in real Supabase Auth later means touching ONLY this file:
//   - verifyDevCredentials() -> a real sign-in call (supabase.auth.signInWithPassword)
//   - the cookie payload -> the real Supabase session token
//   - getAdminSession() -> resolve the session + look up the caller's role
//     in `profiles` instead of decoding a local cookie
// getAdminSession() / requireAdminSession() keep their exact signatures, so
// every call site (layouts, pages, actions) stays untouched.
//
// Isolated on purpose: every file that touches this stand-in is banner-
// commented "DEV AUTH STAND-IN" so a future find-and-replace for real auth
// has a complete list of call sites.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "bl_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8h — a staff work session.

// Placeholder default so the app runs out of the box in dev without any
// env setup. Override with a real value in .env.local; this is still not a
// real secret even when overridden — see the module comment above.
const DEV_PASSWORD = process.env.ADMIN_DEV_PASSWORD ?? "boatlocal-dev";

export interface AdminSession {
  role: "admin";
  email: string;
}

/** Pure — no cookies() call, safe to unit test directly. */
export function verifyDevCredentials(email: string, password: string): boolean {
  return email.trim().length > 0 && password === DEV_PASSWORD;
}

/** Pure — no cookies() call, safe to unit test directly. */
export function encodeAdminSession(session: AdminSession): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

/** Pure — no cookies() call, safe to unit test directly. Returns null on any malformed input rather than throwing, since cookie contents are attacker-influenced input. */
export function decodeAdminSession(value: string): AdminSession | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as { role?: unknown }).role === "admin" &&
      typeof (parsed as { email?: unknown }).email === "string"
    ) {
      return parsed as AdminSession;
    }
  } catch {
    // Malformed/tampered cookie — treat as signed out.
  }
  return null;
}

/** Route Handler / Server Action only — sets the outgoing cookie. */
export async function createAdminSession(email: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, encodeAdminSession({ role: "admin", email: email.trim() }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Route Handler / Server Action only — clears the outgoing cookie. */
export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Server Component read of the current session, or null if signed out. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  return raw ? decodeAdminSession(raw) : null;
}

/**
 * Layer 2 of the three-layer auth model (see the layout that calls this):
 * redirects signed-out visitors to /admin/login. This is a UX convenience,
 * not the only check — every Server Action under src/app/admin still needs
 * to be safe to call directly, since a "use server" action is effectively a
 * public POST endpoint regardless of what layout wraps its page.
 */
export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

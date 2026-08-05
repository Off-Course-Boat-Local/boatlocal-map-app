// DEV AUTH STAND-IN — pure session shape + (de)serialization.
//
// Split out of devAuth.ts for one reason: this module must be importable
// from Client Components (LoginForm.tsx shows DEV_LOGIN_PASSWORD in the
// sign-in hint), and devAuth.ts pulls in `next/headers`, which Next.js
// refuses to let anywhere near a client bundle ("You're importing a module
// that depends on next/headers... only available in Server Components").
// Everything here is plain, dependency-free TypeScript — safe on either
// side — while devAuth.ts stays the server-only module that actually reads
// and writes the cookie.

import type { StudioActor } from "@/lib/data/types";

/** Name of the cookie holding the serialized DevSession. Kept in sync with the constant of the same name in src/proxy.ts (duplicated there on purpose — see that file's header comment). */
export const SESSION_COOKIE_NAME = "bl_studio_session";

/** Accepted for ANY email address. This is the entire "password check". */
export const DEV_LOGIN_PASSWORD = "boatlocal-dev";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type StudioRole = "company" | "guide";

/**
 * The signed-in identity for the Studio app. Deliberately narrower than
 * StudioActor's "admin" case — Studio is company + guide only; the platform
 * owner's admin area is a separate section and out of scope here.
 */
export type DevSession =
  | { role: "company"; email: string; companyId: string; companyName: string }
  | {
      role: "guide";
      email: string;
      companyId: string;
      companyName: string;
      guideId: string;
      guideName: string;
    };

/** Pure, testable: DevSession -> cookie value. */
export function serializeSession(session: DevSession): string {
  return encodeURIComponent(JSON.stringify(session));
}

/** Pure, testable: cookie value -> DevSession, or null for anything missing/malformed/tampered. */
export function parseSessionCookie(raw: string | undefined | null): DevSession | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  const hasCommon =
    typeof obj.email === "string" &&
    typeof obj.companyId === "string" &&
    typeof obj.companyName === "string";
  if (!hasCommon) return null;

  if (obj.role === "company") {
    return {
      role: "company",
      email: obj.email as string,
      companyId: obj.companyId as string,
      companyName: obj.companyName as string,
    };
  }

  if (obj.role === "guide" && typeof obj.guideId === "string" && typeof obj.guideName === "string") {
    return {
      role: "guide",
      email: obj.email as string,
      companyId: obj.companyId as string,
      companyName: obj.companyName as string,
      guideId: obj.guideId,
      guideName: obj.guideName,
    };
  }

  return null;
}

/** Maps a DevSession to the StudioActor shape src/lib/data/source.ts's Studio functions expect. */
export function actorFromSession(session: DevSession): StudioActor {
  if (session.role === "guide") {
    return { role: "guide", companyId: session.companyId, guideId: session.guideId };
  }
  return { role: "company", companyId: session.companyId };
}

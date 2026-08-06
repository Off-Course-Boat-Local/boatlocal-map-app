// Studio session shape — pure, dependency-free, safe on either side of the
// client/server boundary.
//
// This module deliberately carries no Supabase/next-headers imports of its
// own: src/components/studio/RecommendationsManager.tsx imports the
// `StudioRole` type from here (type-only, erased at compile time, so it's
// safe from a "use client" component even though the *value* it types is
// only ever produced server-side), and src/lib/studio/devAuth.ts (the
// server-only module that actually talks to Supabase) re-exports
// `actorFromSession`/`DevSession`/`StudioRole` from here so every existing
// call site (`@/lib/studio/devAuth`'s `actorFromSession`, `requireDevSession`
// etc.) keeps working unchanged.
//
// What used to live here — a hand-rolled cookie serializer/parser and a
// shared dev password — is gone: Supabase Auth (`@supabase/ssr`) now owns
// the actual session cookie, and DevSession is reconstructed on every
// request from a verified JWT + the caller's own `profiles` row (see
// devAuth.ts's getDevSession()) instead of being round-tripped through a
// cookie this app serializes itself.

import type { StudioActor } from "@/lib/data/types";

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

/** Maps a DevSession to the StudioActor shape src/lib/data/source.ts's Studio functions expect. */
export function actorFromSession(session: DevSession): StudioActor {
  if (session.role === "guide") {
    return { role: "guide", companyId: session.companyId, guideId: session.guideId };
  }
  return { role: "company", companyId: session.companyId };
}

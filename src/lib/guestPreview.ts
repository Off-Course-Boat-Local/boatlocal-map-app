// "Is this request Studio's preview rather than a real guest?"
//
// Studio's /studio/preview page renders the real guest app in an iframe so a
// company admin or a guide can click through it exactly as a guest would.
// The whole point is that it behaves like the real thing — which means the
// only thing separating it from real traffic is this flag, and every
// analytics write has to consult it.
//
// FAILS SAFE IN THE RIGHT DIRECTION. The marker is set by the previewer's
// own browser, so in principle someone could suppress their own events by
// hand. That is not worth defending: the damage would be undercounting
// their own tenant's traffic, which is what preview mode does on purpose
// anyway. The direction that would actually matter — a real guest's visit
// being silently dropped — cannot happen, because a real guest never
// arrives with the param and never receives the cookie.
//
// SERVER ONLY: imports `next/headers`.

import { cookies, headers } from "next/headers";

import { GUEST_PREVIEW_COOKIE, GUEST_PREVIEW_HEADER } from "./guestHeaders";

/**
 * True when the current request came from Studio's preview iframe.
 *
 * Checks the header first (set by proxy.ts on the request that carried
 * `?preview=1`) and the cookie second (set by that same response, so every
 * follow-up navigation and every `recordGuestEvent` Server Action POST —
 * neither of which carries the query param — is still recognised).
 */
export async function isPreviewRequest(): Promise<boolean> {
  const requestHeaders = await headers();
  if (requestHeaders.get(GUEST_PREVIEW_HEADER) === "1") return true;

  const cookieStore = await cookies();
  return cookieStore.get(GUEST_PREVIEW_COOKIE)?.value === "1";
}

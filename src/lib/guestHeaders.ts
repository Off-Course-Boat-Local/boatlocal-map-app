// Shared constants for the header hand-off between src/proxy.ts and
// src/lib/guestServerContext.ts. Split into their own module (rather than
// importing straight from proxy.ts) so nothing outside the Proxy runtime
// ever imports proxy.ts itself — Next treats that file specially, and
// pulling app code through it risks bundling the wrong runtime.
export const GUEST_BRAND_HEADER = "x-guest-brand-id";
export const GUEST_GUIDE_HEADER = "x-guest-guide-slug";

// ---------------------------------------------------------------------------
// Preview mode — Studio's /studio/preview renders the REAL guest app in an
// iframe so a company admin or guide can click through it for real. None of
// that browsing may reach analytics: it is not a guest, and counting it
// would inflate every number the same person is being shown one page over.
//
// Three constants, because suppression has to survive three different kinds
// of request:
//   - GUEST_PREVIEW_PARAM  the marker on the iframe's initial URL.
//   - GUEST_PREVIEW_HEADER what proxy.ts attaches so a Server Component
//                          rendering that same request can see it.
//   - GUEST_PREVIEW_COOKIE what makes it stick. In-app navigation and the
//                          `recordGuestEvent` Server Action are separate
//                          requests that do not necessarily carry the query
//                          param, so the param alone would silently stop
//                          suppressing after the first click — which is
//                          exactly the case that matters.
// ---------------------------------------------------------------------------
export const GUEST_PREVIEW_PARAM = "preview";
export const GUEST_PREVIEW_HEADER = "x-guest-preview";
export const GUEST_PREVIEW_COOKIE = "mapapp-preview";

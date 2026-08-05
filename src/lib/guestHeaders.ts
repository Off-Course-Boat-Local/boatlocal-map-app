// Shared constants for the header hand-off between src/proxy.ts and
// src/lib/guestServerContext.ts. Split into their own module (rather than
// importing straight from proxy.ts) so nothing outside the Proxy runtime
// ever imports proxy.ts itself — Next treats that file specially, and
// pulling app code through it risks bundling the wrong runtime.
export const GUEST_BRAND_HEADER = "x-guest-brand-id";
export const GUEST_GUIDE_HEADER = "x-guest-guide-slug";

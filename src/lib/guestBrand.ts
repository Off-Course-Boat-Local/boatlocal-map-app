// Guest brand + guide resolution — the one place hostname/searchParams turn
// into "which tenant is this?".
//
// Real routing (per the founder's decisions / PRD §11, §13.1) is
// `{company}.app.boatlocal.nl/{guideSlug}` — a wildcard subdomain per
// company, with the guide as the first path segment. There is no real
// wildcard DNS/subdomain yet, so until it exists this same function also
// accepts `?company=<brandId>&guide=<slug>` query params as a fallback —
// `<brandId>` being one of the keys in `BRANDS` (src/lib/brand.ts): coastal,
// coral, forest, tulip, ink.
//
// This is deliberately a pure function of plain strings/URLSearchParams
// (no NextRequest, no next/headers) so the exact same algorithm can run in
// two places that must never disagree:
//   - src/proxy.ts (edge, real Next.js Proxy/middleware) — parses the real
//     hostname on every request. Inert today because no request ever
//     arrives on a real `*.app.boatlocal.nl` host; wired now so flipping on
//     real DNS later needs zero code changes here.
//   - src/lib/guestServerContext.ts (server components) — reads the result
//     back out of the headers proxy.ts attaches.
//
// Unit tests: src/lib/guestBrand.test.ts.

import { BRANDS, DEFAULT_BRAND } from "./brand";

/**
 * Fallback guide slug used when neither the hostname path nor `?guide=`
 * names one. Matches the only guide seeded in src/lib/data/fakeStore.ts.
 */
export const DEFAULT_GUIDE_SLUG = "jan";

/** The real (future) platform host. Subdomains of this resolve a company. */
const PLATFORM_HOST_SUFFIX = ".app.boatlocal.nl";

export interface GuestBrandResolution {
  /** A key of BRANDS (src/lib/brand.ts), e.g. "coastal". */
  brandId: string;
  guideSlug: string;
}

export interface ResolveGuestBrandInput {
  /** `request.nextUrl.hostname` / `window.location.hostname`. May include no port. */
  hostname?: string | null;
  /** `request.nextUrl.pathname` — only its first segment is used, as the guide slug. */
  pathname?: string | null;
  /**
   * Query string params. Accepts a real `URLSearchParams` (proxy.ts,
   * browser) or the plain object shape a Next.js Server Component's
   * `searchParams` prop resolves to.
   */
  searchParams?: URLSearchParams | Record<string, string | string[] | undefined>;
}

function isKnownBrand(id: string): id is keyof typeof BRANDS {
  return Object.prototype.hasOwnProperty.call(BRANDS, id);
}

function toURLSearchParams(
  input: ResolveGuestBrandInput["searchParams"],
): URLSearchParams {
  if (!input) return new URLSearchParams();
  if (input instanceof URLSearchParams) return input;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value == null) continue;
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  return params;
}

function firstPathSegment(pathname: string | null | undefined): string | null {
  const segment = (pathname ?? "").split("/").find(Boolean);
  return segment ?? null;
}

/**
 * Resolves a brand id + guide slug from a hostname and/or search params.
 *
 * Resolution order:
 *  1. Real subdomain — `{brandId}.app.boatlocal.nl`, where `{brandId}` is a
 *     known key of BRANDS. The guide slug is the first path segment, e.g.
 *     `/jan`. Not exercised until real DNS/hosting exists.
 *  2. Query-param fallback — `?company=<brandId>&guide=<slug>`.
 *  3. DEFAULT_BRAND.id / DEFAULT_GUIDE_SLUG.
 *
 * An unrecognised subdomain or `?company=` value is treated as "not given"
 * rather than an error — the guest still gets a working (default-branded)
 * app instead of a broken one.
 */
export function resolveGuestBrand(
  input: ResolveGuestBrandInput,
): GuestBrandResolution {
  const hostname = (input.hostname ?? "").toLowerCase().split(":")[0];

  if (hostname.endsWith(PLATFORM_HOST_SUFFIX)) {
    const subdomain = hostname.slice(0, -PLATFORM_HOST_SUFFIX.length);
    if (subdomain && isKnownBrand(subdomain)) {
      return {
        brandId: subdomain,
        guideSlug: firstPathSegment(input.pathname) ?? DEFAULT_GUIDE_SLUG,
      };
    }
  }

  const params = toURLSearchParams(input.searchParams);
  const queryBrand = params.get("company");
  const brandId =
    queryBrand && isKnownBrand(queryBrand) ? queryBrand : DEFAULT_BRAND.id;
  const guideSlug = params.get("guide") || DEFAULT_GUIDE_SLUG;

  return { brandId, guideSlug };
}

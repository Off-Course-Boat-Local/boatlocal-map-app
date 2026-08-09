// Guest brand + guide resolution — the one place hostname/searchParams turn
// into "which tenant is this?".
//
// Real routing (per the founder's decisions / PRD §11, §13.1) is
// `{company}.map.boatlocal.nl/{guideSlug}` — a wildcard subdomain per
// company, with the guide as the first path segment. There is no real
// wildcard DNS/subdomain yet, so until it exists this same function also
// accepts `?company=<subdomain>&guide=<slug>` query params as a fallback.
// `<subdomain>` is any company's real subdomain (src/lib/data/types.ts's
// CompanyRecord.subdomain) — NOT limited to src/lib/brand.ts's five preview
// swatches; see resolveGuestBrand's own doc comment for why that used to be
// a real bug.
//
// This is deliberately a pure function of plain strings/URLSearchParams
// (no NextRequest, no next/headers, no database access) so the exact same
// algorithm can run in two places that must never disagree:
//   - src/proxy.ts (edge, real Next.js Proxy/middleware) — parses the real
//     hostname on every request. Inert today because no request ever
//     arrives on a real `*.map.boatlocal.nl` host; wired now so flipping on
//     real DNS later needs zero code changes here.
//   - src/lib/guestServerContext.ts (server components) — reads the result
//     back out of the headers proxy.ts attaches, then does the actual
//     database lookup to find out whether it's real.
//
// Unit tests: src/lib/guestBrand.test.ts.

import { DEFAULT_BRAND } from "./brand";

/**
 * Fallback guide slug used when neither the hostname path nor `?guide=`
 * names one. Matches the only guide seeded in src/lib/data/fakeStore.ts.
 */
export const DEFAULT_GUIDE_SLUG = "jan";

/** The real (future) platform host. Subdomains of this resolve a company. */
const PLATFORM_HOST_SUFFIX = ".map.boatlocal.nl";

export interface GuestBrandResolution {
  /**
   * Any company's real subdomain, or DEFAULT_BRAND.id if none was given.
   * Whether it corresponds to a real, active company is determined
   * downstream (src/lib/guestServerContext.ts), not here.
   */
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
 *  1. Real subdomain — `{brandId}.map.boatlocal.nl`. The guide slug is the
 *     first path segment, e.g. `/jan`. Not exercised until real DNS/hosting
 *     exists.
 *  2. Query-param fallback — `?company=<brandId>&guide=<slug>`.
 *  3. DEFAULT_BRAND.id / DEFAULT_GUIDE_SLUG, when neither of the above
 *     supplied anything at all.
 *
 * BUG FIXED (found by live-testing against the real database, not by any
 * automated check — see the conversation history): this function used to
 * validate `brandId` against `BRANDS` (src/lib/brand.ts's five hardcoded
 * PREVIEW swatches — coastal/coral/forest/tulip/ink) and silently substitute
 * DEFAULT_BRAND.id for anything it didn't recognise. That was correct back
 * when those five names were the only tenants that could possibly exist.
 * Now that Admin can onboard real companies with arbitrary subdomains
 * (src/lib/data/source.ts's createCompany), that gate was silently
 * discarding every real company's identifier that wasn't one of the five
 * previews and substituting "coastal" instead — so an unknown OR a
 * perfectly real, newly-onboarded company's URL would render as if it were
 * "coastal", using ITS real seeded data. That is a real information
 * disclosure (the wrong company's content rendering under someone else's
 * link), not just a cosmetic fallback.
 *
 * This function has no business deciding what counts as "real" — it is a
 * pure string transform (deliberately no database access, so the exact
 * same algorithm can run in src/proxy.ts at the edge). Real/unknown is a
 * database question, correctly already answered downstream by
 * getActiveCompanyRecord (src/lib/data/source.ts) — that function returns
 * null for anything that isn't a real active company, which is what
 * src/lib/guestServerContext.ts uses to decide companyId, which is what
 * every screen actually gates its data on. So this function's only job now
 * is "pass through whatever identifier was actually given, or the default
 * if literally nothing was," never to pre-judge whether it's real.
 */
export function resolveGuestBrand(
  input: ResolveGuestBrandInput,
): GuestBrandResolution {
  const hostname = (input.hostname ?? "").toLowerCase().split(":")[0];

  if (hostname.endsWith(PLATFORM_HOST_SUFFIX)) {
    const subdomain = hostname.slice(0, -PLATFORM_HOST_SUFFIX.length);
    if (subdomain) {
      return {
        brandId: subdomain,
        guideSlug: firstPathSegment(input.pathname) ?? DEFAULT_GUIDE_SLUG,
      };
    }
  }

  const params = toURLSearchParams(input.searchParams);
  const queryBrand = params.get("company")?.trim();
  const brandId = queryBrand || DEFAULT_BRAND.id;
  const guideSlug = params.get("guide") || DEFAULT_GUIDE_SLUG;

  return { brandId, guideSlug };
}

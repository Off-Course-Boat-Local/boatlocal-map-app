// Guest brand + guide resolution — the one place searchParams turn into
// "which tenant is this?".
//
// The real, permanent routing mechanism (per the founder's decision — see
// this task's own notes: companies no longer have a subdomain at all, "that
// field should just be an ID") is `?company=<id>&guide=<slug>` query params
// on the plain site root. There is no wildcard-subdomain routing to grow
// into later: the founder was explicit that these companies will never be
// applying subdomains, so the query-param form isn't a stand-in for
// anything else coming — it's the whole mechanism. `<id>` is a company's
// real primary key (src/lib/data/types.ts's CompanyRecord.id) — NOT limited
// to src/lib/brand.ts's five preview swatches; see resolveGuestBrand's own
// doc comment for why that used to be a real bug.
//
// This is deliberately a pure function of a plain URLSearchParams-like
// value (no NextRequest, no next/headers, no database access) so the exact
// same algorithm can run in two places that must never disagree:
//   - src/proxy.ts (edge, real Next.js Proxy/middleware) — resolves this
//     once per request and attaches the result as headers.
//   - src/lib/guestServerContext.ts (server components) — reads the result
//     back out of those headers, then does the actual database lookup to
//     find out whether it's real.
//
// Unit tests: src/lib/guestBrand.test.ts.

import { DEFAULT_BRAND } from "./brand";

/**
 * Fallback guide slug used when `?guide=` names none. Matches the only
 * guide seeded in src/lib/data/fakeStore.ts.
 */
export const DEFAULT_GUIDE_SLUG = "jan";

export interface GuestBrandResolution {
  /**
   * Any company's real id, or DEFAULT_BRAND.id if none was given. Named
   * `brandId` rather than `companyId` because it is not always a real
   * company id — it doubles as one of src/lib/brand.ts's five preview
   * swatch keys (coastal/coral/forest/tulip/ink) for browsing brands with no
   * seeded row, and src/lib/guestServerContext.ts already has its own
   * `companyId` field for "the real, resolved, active company's id (or
   * null)" — a genuinely different value from this one. Whether this
   * corresponds to a real, active company is determined downstream
   * (src/lib/guestServerContext.ts), not here.
   */
  brandId: string;
  guideSlug: string;
}

export interface ResolveGuestBrandInput {
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

/**
 * Resolves a brand id + guide slug from `?company=<id>&guide=<slug>`,
 * falling back to DEFAULT_BRAND.id / DEFAULT_GUIDE_SLUG when either is
 * missing.
 *
 * BUG FIXED (found by live-testing against the real database, not by any
 * automated check — see the conversation history): this function used to
 * validate `brandId` against `BRANDS` (src/lib/brand.ts's five hardcoded
 * PREVIEW swatches — coastal/coral/forest/tulip/ink) and silently substitute
 * DEFAULT_BRAND.id for anything it didn't recognise. That was correct back
 * when those five names were the only tenants that could possibly exist.
 * Now that Admin can onboard real companies (src/lib/data/source.ts's
 * createCompany), that gate was silently discarding every real company's
 * identifier that wasn't one of the five previews and substituting
 * "coastal" instead — so an unknown OR a perfectly real, newly-onboarded
 * company's URL would render as if it were "coastal", using ITS real
 * seeded data. That is a real information disclosure (the wrong company's
 * content rendering under someone else's link), not just a cosmetic
 * fallback.
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
  const params = toURLSearchParams(input.searchParams);
  const queryBrand = params.get("company")?.trim();
  const brandId = queryBrand || DEFAULT_BRAND.id;
  const guideSlug = params.get("guide") || DEFAULT_GUIDE_SLUG;

  return { brandId, guideSlug };
}

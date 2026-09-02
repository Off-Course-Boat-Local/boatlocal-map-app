// Server-only helper: turns the { brandId, guideSlug } that src/proxy.ts
// already resolved (see src/lib/guestBrand.ts) into the objects a guest
// screen actually renders — brand tokens, company id, guide.
//
// SERVER ONLY: imports `next/headers`, so this must only be imported from a
// Server Component (a `(guest)/**/page.tsx` or `(guest)/layout.tsx`), never
// from a "use client" component. Client components receive the resolved
// values as plain props instead (see src/components/guest/GuestMapScreen.tsx).
//
// Every screen reads tenant data through src/lib/data/source.ts, per the
// project's DataSource rule — never Supabase, never the fake store,
// directly.
//
// FALLBACK, WHEN brandId NAMES NO REAL, ACTIVE COMPANY: this used to fall
// through to src/lib/brand.ts's BRANDS[brandId] swatches (or DEFAULT_BRAND
// if brandId matched none of those either) — the exact bug this file was
// fixed for: a real visitor with no `?company=` at all landed on a
// hardcoded, prototype-era fake business ("Jan's Amsterdam"), not anything
// real or intentional. The real fallback now is whichever company Admin has
// flagged as the platform default (src/lib/data/source.ts's
// getPlatformDefaultCompany/setPlatformDefaultCompany — a normal company row,
// managed through the same Studio-style Branding/Recommendations tools as
// any tenant, just surfaced from Admin instead of Studio; see
// src/app/admin/(protected)/default-company/page.tsx). If nothing has been
// flagged yet (fresh install), NEUTRAL_FALLBACK_BRAND below is a plain,
// honest "Map App" identity — never a fabricated business name — with no
// companyId, so every guest screen's recommendations/boat tours/guide
// naturally resolve to an empty state rather than fabricated content.

import { cache } from "react";
import { headers } from "next/headers";

import { PORTAL_ACCENT } from "../components/MapAppMark";
import { DEFAULT_BRAND } from "./brand";
import {
  getActiveCompanyRecord,
  getCompanyBrand,
  getCompanyByCustomDomain,
  getGuide,
  getPlatformDefaultCompany,
  toBrand,
} from "./data/source";
import { DEFAULT_GUIDE_SLUG } from "./guestBrand";
import { GUEST_BRAND_HEADER, GUEST_GUIDE_HEADER } from "./guestHeaders";
import type { Brand, Guide } from "./types";

/**
 * The one honest identity for a guest visit with no real company behind it
 * at all (no `?company=`, and no platform default configured yet). Colours
 * lifted straight from src/components/MapAppMark.tsx's own badge — the
 * product's own wordmark on every staff-facing surface — rather than any of
 * src/lib/brand.ts's five prototype-era tenant swatches, none of which have
 * any business standing in for "no tenant".
 */
const NEUTRAL_FALLBACK_BRAND: Brand = {
  id: "map-app",
  companyName: "Map App",
  appName: "Map App",
  primary: PORTAL_ACCENT,
  primaryDark: "#14449E",
  accent: "#FF7A45",
  // The exact background the Admin/Studio dashboards use — founder-specified
  // (#F6F6F3, 2026-08-24, correcting an earlier #E8E6DF guess): the guest
  // app's desktop surround must stay in the same family as the portals.
  // PhoneFrame's own `var(--brand-surround, ...)` fallback carries the same
  // value.
  surround: "#F6F6F3",
  logoUrl: null,
};

export interface GuestContext {
  brandId: string;
  guideSlug: string;
  brand: Brand;
  /** Null when brandId names no real, active company AND no platform default is configured — see NEUTRAL_FALLBACK_BRAND above. */
  companyId: string | null;
  /** Null when there is no companyId, or no active guide at that slug. */
  guide: Guide | null;
}

/**
 * Reads the brand id / guide slug proxy.ts attached to this request, then
 * resolves them to real data through src/lib/data/source.ts.
 *
 * Wrapped in React `cache()` below: every guest route calls this at least
 * twice per request (once from the (guest) layout for chrome, again from
 * the leaf page for its own data), and on a `?company=`-less visit (e.g.
 * every real visit to a company's own custom domain — see
 * getCompanyByCustomDomain's own comment) that means the custom-domain
 * lookup, getGuide, etc. all ran twice per navigation, un-deduplicated —
 * a real, measured contributor to guest-app load time (founder report,
 * 2026-09-02: "loading is very very slow"). `cache()` makes every call
 * within the same request share one in-flight resolution; a different
 * request (the next navigation) still resolves fresh, exactly as before.
 */
async function getGuestContextUncached(): Promise<GuestContext> {
  const requestHeaders = await headers();
  const brandId = requestHeaders.get(GUEST_BRAND_HEADER) ?? DEFAULT_BRAND.id;
  const guideSlug = requestHeaders.get(GUEST_GUIDE_HEADER) ?? DEFAULT_GUIDE_SLUG;

  const [brandFromSource, companyRecord] = await Promise.all([
    getCompanyBrand(brandId),
    getActiveCompanyRecord(brandId),
  ]);

  if (companyRecord) {
    const companyId = companyRecord.id;
    const guide = await getGuide(companyId, guideSlug);
    return { brandId, guideSlug, brand: brandFromSource ?? toBrand(companyRecord), companyId, guide };
  }

  // No real company behind the query-param brandId (including the common
  // case of no `?company=` at all). Before falling back to the shared
  // platform default, check whether this REQUEST'S OWN HOSTNAME belongs to
  // one company specifically — e.g. a visit to map.offcourseamsterdam.com
  // with no query param at all should show Off Course Amsterdam, not
  // whichever company Admin happens to have flagged as the platform-wide
  // default for the shared boatlocal.nl domain. `host` is a standard
  // incoming header Next.js already exposes here with no proxy.ts changes
  // needed — see getCompanyByCustomDomain's own comment for the RLS/lookup
  // side of this.
  const host = requestHeaders.get("host");
  const byDomain = host ? await getCompanyByCustomDomain(host) : null;
  if (byDomain) {
    const companyId = byDomain.id;
    const guide = await getGuide(companyId, guideSlug);
    return { brandId, guideSlug, brand: toBrand(byDomain), companyId, guide };
  }

  // Still nothing company-specific — see this file's header comment for why
  // the fallback is the shared platform default company, not
  // src/lib/brand.ts's preview swatches.
  const platformDefault = await getPlatformDefaultCompany();
  if (platformDefault && platformDefault.status === "active") {
    const companyId = platformDefault.id;
    const guide = await getGuide(companyId, guideSlug);
    return { brandId, guideSlug, brand: toBrand(platformDefault), companyId, guide };
  }

  // Fresh install: no platform default has been configured yet. A plain,
  // honest "Map App" identity beats fabricating a business that doesn't
  // exist — and no companyId means every guest screen's recommendations/
  // boat tours/guide naturally resolve to an empty state, not fabricated
  // content.
  return { brandId, guideSlug, brand: NEUTRAL_FALLBACK_BRAND, companyId: null, guide: null };
}

/** See getGuestContextUncached's doc comment — this is the one every caller should use. */
export const getGuestContext = cache(getGuestContextUncached);

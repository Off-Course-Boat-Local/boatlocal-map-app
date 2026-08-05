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
// directly. `getCompanyBrand`/`getCompanyRecord` only resolve for tenants
// actually seeded in src/lib/data/fakeStore.ts (today: "coastal"). For the
// other four BRANDS keys — kept around so every skin stays previewable via
// `?company=` while more tenants aren't seeded yet — this falls back to the
// static swatch in src/lib/brand.ts so the app still renders, just without
// live company/guide data.

import { headers } from "next/headers";

import { BRANDS, DEFAULT_BRAND } from "./brand";
import { getActiveCompanyRecord, getCompanyBrand, getGuide } from "./data/source";
import { DEFAULT_GUIDE_SLUG } from "./guestBrand";
import { GUEST_BRAND_HEADER, GUEST_GUIDE_HEADER } from "./guestHeaders";
import type { Brand, Guide } from "./types";

export interface GuestContext {
  brandId: string;
  guideSlug: string;
  brand: Brand;
  /** Null when brandId has no seeded row in the fake store (preview-only brand). */
  companyId: string | null;
  /** Null when there is no companyId, or no active guide at that slug. */
  guide: Guide | null;
}

/**
 * Reads the brand id / guide slug proxy.ts attached to this request, then
 * resolves them to real data through src/lib/data/source.ts.
 *
 * Safe to call more than once per request (e.g. once from the (guest)
 * layout for chrome, again from a leaf page for its own data) — every call
 * is cheap today (in-memory fake store); once Supabase exists this is the
 * one place to add request-level memoisation (React `cache()`) if needed.
 */
export async function getGuestContext(): Promise<GuestContext> {
  const requestHeaders = await headers();
  const brandId = requestHeaders.get(GUEST_BRAND_HEADER) ?? DEFAULT_BRAND.id;
  const guideSlug = requestHeaders.get(GUEST_GUIDE_HEADER) ?? DEFAULT_GUIDE_SLUG;

  const [brandFromSource, companyRecord] = await Promise.all([
    getCompanyBrand(brandId),
    getActiveCompanyRecord(brandId),
  ]);

  const brand: Brand = brandFromSource ?? BRANDS[brandId] ?? DEFAULT_BRAND;
  const companyId = companyRecord?.id ?? null;
  const guide: Guide | null = companyId
    ? await getGuide(companyId, guideSlug)
    : null;

  return { brandId, guideSlug, brand, companyId, guide };
}

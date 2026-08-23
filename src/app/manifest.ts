// Web App Manifest — makes the guest app installable (PRD §5.7). See
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions
// /01-metadata/manifest.md: `app/manifest.ts` at the app root is the
// supported convention in this Next.js version (there is no per-route-group
// manifest file).
//
// DYNAMIC BY DESIGN, WITH A KNOWN GAP: this reads the same
// x-guest-brand-id header src/proxy.ts attaches to every guest request (see
// src/lib/guestServerContext.ts), via next/headers's `headers()` — a
// request-time API, which is what keeps this manifest per-request instead of
// built once and cached forever (see the "Good to know" note in the docs
// above).
//
// The gap: the browser's manifest fetch does not carry the guest page's own
// `?company=`/`?guide=` query string (src/lib/guestBrand.ts's real,
// permanent routing mechanism — see its header comment), so this always
// resolves to DEFAULT_BRAND rather than whichever company's link the guest
// actually opened. That's an inherent limitation of manifest fetches, not a
// bug here, and — since there is no real subdomain routing coming to grow
// into instead (the founder's decision: companies never get one) — there is
// no future fix that makes this per-tenant short of Next.js someday passing
// query params to a manifest fetch.
//
// ICONS: no real per-company icon exists yet — CompanyRecord.logoUrl
// (src/lib/data/types.ts) is the eventual, guide-uploaded source (same idea
// as PhotoGallery photos). Until a company sets one, every tenant gets the
// same neutral placeholder in public/icons/ — deliberately not any one
// tenant's brand colour (see src/lib/brand.ts's brandCssVars rule; a static
// manifest icon file can't read a CSS custom property anyway).

import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { BRANDS, DEFAULT_BRAND } from "@/lib/brand";
import { getActiveCompanyRecord, getCompanyBrand } from "@/lib/data/source";
import { GUEST_BRAND_HEADER } from "@/lib/guestHeaders";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const requestHeaders = await headers();
  const brandId = requestHeaders.get(GUEST_BRAND_HEADER) ?? DEFAULT_BRAND.id;

  const [brandFromSource, companyRecord] = await Promise.all([
    getCompanyBrand(brandId),
    getActiveCompanyRecord(brandId),
  ]);
  const brand = brandFromSource ?? BRANDS[brandId] ?? DEFAULT_BRAND;
  const iconSrc = companyRecord?.logoUrl;

  return {
    name: brand.appName,
    short_name: brand.appName,
    description: `${brand.companyName}'s guide to the city, on your phone.`,
    start_url: "/map",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: brand.primary,
    icons: iconSrc
      ? [{ src: iconSrc, sizes: "any", purpose: "any" }]
      : [
          {
            src: "/icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icons/icon-maskable.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
  };
}

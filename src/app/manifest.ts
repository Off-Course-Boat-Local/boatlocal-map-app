// Web App Manifest — makes the guest app installable (PRD §5.7). See
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions
// /01-metadata/manifest.md: `app/manifest.ts` at the app root is the
// supported convention in this Next.js version (there is no per-route-group
// manifest file).
//
// DYNAMIC BY DESIGN: this reads the same x-guest-brand-id header
// src/proxy.ts attaches to every guest request (see
// src/lib/guestServerContext.ts), via next/headers's `headers()` — a
// request-time API, which is what keeps this manifest per-request instead of
// built once and cached forever (see the "Good to know" note in the docs
// above).
//
// FIXED REGRESSION (2026-08-24): a browser's manifest fetch never carries
// the ORIGINAL PAGE's `?company=`/`?guide=` query string on its own — that
// part is a real, permanent limitation. This used to mean every guest,
// regardless of which company/guide link they'd actually opened, installed
// a PWA hardcoded to DEFAULT_BRAND ("Jan's Amsterdam") — a real bug for
// every white-label client, not just the demo. The actual fix lives one
// level up: src/app/(guest)/layout.tsx's generateMetadata() points the
// `<link rel="manifest">` itself at
// `/manifest.webmanifest?company=…&guide=…`, carrying the real tenant on
// the MANIFEST request's own query string — which src/proxy.ts's matcher
// already covers, so x-guest-brand-id below resolves correctly. This file
// keeps reading the header (not the query string directly) so it stays
// correct even if something other than that layout ever links to it.
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

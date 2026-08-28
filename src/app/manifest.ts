// Web App Manifest — makes the guest app installable (PRD §5.7). See
// Next.js metadata docs: `app/manifest.ts` at the app root is the supported convention.
//
// DYNAMIC & TENANT-AWARE:
// Reads the guest context (via getGuestContext, which inspects request headers
// attached by src/proxy.ts or query parameters via generated metadata links).
//
// When a guest opens a company link (e.g., ?company=<uuid>), the installed PWA
// inherits that company's appName or companyName.
// When no company is specified, it defaults to "BoatLocal Map App".

import type { MetadataRoute } from "next";

import { getGuestContext } from "@/lib/guestServerContext";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const context = await getGuestContext();
  const brand = context.brand;

  const appName = brand.appName || brand.companyName || "BoatLocal Map App";
  const companyName = brand.companyName || "Boat Local";

  return {
    name: appName,
    short_name: appName,
    description: `${companyName}'s guide to the city, on your phone.`,
    start_url: "/map",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: brand.primary || "#2B4FE0",
    icons: [
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

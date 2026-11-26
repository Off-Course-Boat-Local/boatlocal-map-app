import type { MetadataRoute } from "next";

// This whole app is the guest/studio tool behind map.boatlocal.nl, never a
// page meant to rank — see the root layout's `metadata.robots` for the
// per-page noindex. This blocks the whole site at the crawler level too
// (covers crawlers that ignore meta tags, and non-HTML routes).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}

import { describe, expect, it } from "vitest";

import { BRANDS, DEFAULT_BRAND } from "./brand";
import { DEFAULT_GUIDE_SLUG, resolveGuestBrand } from "./guestBrand";

describe("resolveGuestBrand", () => {
  it("falls back to the default brand and guide when nothing is given", () => {
    expect(resolveGuestBrand({})).toEqual({
      brandId: DEFAULT_BRAND.id,
      guideSlug: DEFAULT_GUIDE_SLUG,
    });
  });

  it("resolves a brand from the ?company= query param", () => {
    expect(
      resolveGuestBrand({ searchParams: new URLSearchParams("company=coral") }),
    ).toEqual({ brandId: "coral", guideSlug: DEFAULT_GUIDE_SLUG });
  });

  it("resolves a guide slug from the ?guide= query param", () => {
    expect(
      resolveGuestBrand({
        searchParams: new URLSearchParams("company=forest&guide=maria"),
      }),
    ).toEqual({ brandId: "forest", guideSlug: "maria" });
  });

  it("accepts a plain object shape (Next.js resolved searchParams)", () => {
    expect(
      resolveGuestBrand({ searchParams: { company: "tulip", guide: "amir" } }),
    ).toEqual({ brandId: "tulip", guideSlug: "amir" });
  });

  it("ignores an unrecognised ?company= value and falls back to default", () => {
    expect(
      resolveGuestBrand({ searchParams: new URLSearchParams("company=not-a-brand") }),
    ).toEqual({ brandId: DEFAULT_BRAND.id, guideSlug: DEFAULT_GUIDE_SLUG });
  });

  it("every real brand key round-trips through the query param", () => {
    for (const brandId of Object.keys(BRANDS)) {
      expect(
        resolveGuestBrand({ searchParams: new URLSearchParams(`company=${brandId}`) }),
      ).toEqual({ brandId, guideSlug: DEFAULT_GUIDE_SLUG });
    }
  });

  it("ignores a hostname that is not on the platform's domain", () => {
    expect(
      resolveGuestBrand({ hostname: "localhost", pathname: "/jan" }),
    ).toEqual({ brandId: DEFAULT_BRAND.id, guideSlug: DEFAULT_GUIDE_SLUG });
  });

  it("resolves brand + guide from a real subdomain and its first path segment", () => {
    expect(
      resolveGuestBrand({
        hostname: "coral.app.boatlocal.nl",
        pathname: "/jan/map",
      }),
    ).toEqual({ brandId: "coral", guideSlug: "jan" });
  });

  it("is case-insensitive on the hostname", () => {
    expect(
      resolveGuestBrand({ hostname: "CORAL.APP.BOATLOCAL.NL", pathname: "/jan" }),
    ).toEqual({ brandId: "coral", guideSlug: "jan" });
  });

  it("strips a port from the hostname before matching", () => {
    expect(
      resolveGuestBrand({ hostname: "coral.app.boatlocal.nl:3000", pathname: "/jan" }),
    ).toEqual({ brandId: "coral", guideSlug: "jan" });
  });

  it("falls back to the default guide slug when a real subdomain has no path segment", () => {
    expect(
      resolveGuestBrand({ hostname: "coral.app.boatlocal.nl", pathname: "/" }),
    ).toEqual({ brandId: "coral", guideSlug: DEFAULT_GUIDE_SLUG });
  });

  it("treats an unrecognised subdomain as absent and falls through to query params", () => {
    expect(
      resolveGuestBrand({
        hostname: "not-a-tenant.app.boatlocal.nl",
        pathname: "/jan",
        searchParams: new URLSearchParams("company=ink"),
      }),
    ).toEqual({ brandId: "ink", guideSlug: DEFAULT_GUIDE_SLUG });
  });

  it("prefers a matched real subdomain over query params", () => {
    expect(
      resolveGuestBrand({
        hostname: "coral.app.boatlocal.nl",
        pathname: "/jan",
        searchParams: new URLSearchParams("company=ink&guide=someone-else"),
      }),
    ).toEqual({ brandId: "coral", guideSlug: "jan" });
  });
});

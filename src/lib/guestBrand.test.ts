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

  it("passes through a company subdomain that isn't one of the five preview brands", () => {
    // Regression test for a real bug (found by live-testing against the
    // real database, not by any automated check): this function used to
    // validate the value against BRANDS' five hardcoded preview swatches
    // and silently substitute the default for anything else. That meant a
    // real, newly-onboarded company's own subdomain — anything other than
    // coastal/coral/forest/tulip/ink — would render as "coastal" instead,
    // serving a completely different company's real content under the
    // wrong link. This function has no database access and must not
    // pre-judge what's "real" — that's decided downstream in
    // getActiveCompanyRecord, which correctly returns null for anything
    // that isn't an actual active company.
    expect(
      resolveGuestBrand({ searchParams: new URLSearchParams("company=hotelv") }),
    ).toEqual({ brandId: "hotelv", guideSlug: DEFAULT_GUIDE_SLUG });
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

  it("passes through ANY subdomain on the platform host, not just the five previews", () => {
    // Same bug as the query-param regression test above, for the subdomain
    // path specifically: a real company's own subdomain used to be
    // silently discarded here too if it wasn't one of BRANDS' five preview
    // keys, ignoring query params entirely and falling to the default
    // brand rather than passing the real subdomain through.
    expect(
      resolveGuestBrand({
        hostname: "hotelv.app.boatlocal.nl",
        pathname: "/jan",
        searchParams: new URLSearchParams("company=ink"),
      }),
    ).toEqual({ brandId: "hotelv", guideSlug: "jan" });
  });

  it("prefers a matched subdomain over query params", () => {
    expect(
      resolveGuestBrand({
        hostname: "coral.app.boatlocal.nl",
        pathname: "/jan",
        searchParams: new URLSearchParams("company=ink&guide=someone-else"),
      }),
    ).toEqual({ brandId: "coral", guideSlug: "jan" });
  });
});

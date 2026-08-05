import { describe, expect, it } from "vitest";

import { COMPANY_NAV, GUIDE_NAV, navForRole } from "./nav";

describe("Studio nav gating", () => {
  it("gives company the full nav, in the specified order", () => {
    expect(navForRole("company")).toBe(COMPANY_NAV);
    expect(COMPANY_NAV.map((i) => i.label)).toEqual([
      "Dashboard",
      "Branding",
      "Guides",
      "Recommendations",
      "Boat tours",
      "Campaign",
      "Report",
    ]);
  });

  it("gives guide only Dashboard, Recommendations and their own Link & QR / Stats", () => {
    expect(navForRole("guide")).toBe(GUIDE_NAV);
    expect(GUIDE_NAV.map((i) => i.label)).toEqual([
      "Dashboard",
      "Recommendations",
      "Link & QR / Stats",
    ]);
  });

  it("never gives a guide the company-only management tabs", () => {
    const guideHrefs = new Set(GUIDE_NAV.map((i) => i.href));
    for (const companyOnlyHref of [
      "/studio/branding",
      "/studio/guides",
      "/studio/boat-tours",
      "/studio/campaign",
    ]) {
      expect(guideHrefs.has(companyOnlyHref)).toBe(false);
    }
  });

  it("gives every nav item a unique key within its list", () => {
    for (const list of [COMPANY_NAV, GUIDE_NAV]) {
      expect(new Set(list.map((i) => i.key)).size).toBe(list.length);
    }
  });
});

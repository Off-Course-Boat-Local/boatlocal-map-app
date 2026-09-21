import { describe, expect, it } from "vitest";

import { companyDashboardKpis, guideDashboardKpis } from "./dashboardAnalytics";
import type { AnalyticsSummaryRow } from "@/lib/data/types";

describe("companyDashboardKpis", () => {
  it("never includes a 'tours booked' / booking_outcome KPI — booking data is admin-only, not Studio-visible", () => {
    const rows: AnalyticsSummaryRow[] = [
      { eventType: "booking_outcome", guideId: null, count: 5 },
      { eventType: "app_open", guideId: null, count: 10 },
    ];
    const kpis = companyDashboardKpis(rows, 2);
    expect(kpis.some((k) => k.key === "tours-booked")).toBe(false);
    expect(kpis.some((k) => /tours booked/i.test(k.label))).toBe(false);
  });

  it("still reports active guides, app opens, tips saved, directions asked, and directions finished", () => {
    const rows: AnalyticsSummaryRow[] = [
      { eventType: "app_open", guideId: null, count: 10 },
      { eventType: "tip_saved", guideId: null, count: 3 },
      { eventType: "directions_requested", guideId: null, count: 7 },
      { eventType: "directions_arrived", guideId: null, count: 4 },
    ];
    const kpis = companyDashboardKpis(rows, 2);
    expect(kpis.find((k) => k.key === "active-guides")?.value).toBe(2);
    expect(kpis.find((k) => k.key === "app-opens")?.value).toBe(10);
    expect(kpis.find((k) => k.key === "tips-saved")?.value).toBe(3);
    expect(kpis.find((k) => k.key === "directions-asked")?.value).toBe(7);
    expect(kpis.find((k) => k.key === "directions-finished")?.value).toBe(4);
  });
});

describe("guideDashboardKpis", () => {
  it("was never affected by the booking-outcome admin-only change (no booking KPI here either way)", () => {
    const rows: AnalyticsSummaryRow[] = [{ eventType: "app_open", guideId: "g1", count: 4 }];
    const kpis = guideDashboardKpis(rows, 3);
    expect(kpis.some((k) => k.key.includes("book") && k.key !== "book-clicks")).toBe(false);
  });

  it("reports app opens, book clicks, places, directions asked, and directions finished", () => {
    const rows: AnalyticsSummaryRow[] = [
      { eventType: "app_open", guideId: "g1", count: 8 },
      { eventType: "boat_book_click", guideId: "g1", count: 2 },
      { eventType: "directions_requested", guideId: "g1", count: 5 },
      { eventType: "directions_arrived", guideId: "g1", count: 3 },
    ];
    const kpis = guideDashboardKpis(rows, 12);
    expect(kpis.find((k) => k.key === "app-opens")?.value).toBe(8);
    expect(kpis.find((k) => k.key === "book-clicks")?.value).toBe(2);
    expect(kpis.find((k) => k.key === "places")?.value).toBe(12);
    expect(kpis.find((k) => k.key === "directions-asked")?.value).toBe(5);
    expect(kpis.find((k) => k.key === "directions-finished")?.value).toBe(3);
  });
});

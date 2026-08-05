import { describe, expect, it } from "vitest";

import { mockGuidePerformance, mockPlatformEffectiveness } from "./mockAnalytics";

describe("mockGuidePerformance", () => {
  it("is deterministic for the same guide id", () => {
    expect(mockGuidePerformance("guide-1")).toEqual(mockGuidePerformance("guide-1"));
  });

  it("varies between different guide ids", () => {
    expect(mockGuidePerformance("guide-1")).not.toEqual(mockGuidePerformance("guide-2"));
  });

  it("keeps every field within its documented range", () => {
    for (const id of ["guide-1", "guide-2", "guide-3", "some-other-guide"]) {
      const perf = mockGuidePerformance(id);
      expect(perf.appOpens).toBeGreaterThanOrEqual(20);
      expect(perf.appOpens).toBeLessThanOrEqual(500);
      expect(perf.tipsSaved).toBeGreaterThanOrEqual(2);
      expect(perf.tipsSaved).toBeLessThanOrEqual(140);
      expect(perf.bookClicks).toBeGreaterThanOrEqual(0);
      expect(perf.bookClicks).toBeLessThanOrEqual(40);
    }
  });
});

describe("mockPlatformEffectiveness", () => {
  it("is deterministic for the same seed", () => {
    expect(mockPlatformEffectiveness("all::2026-01-01::2026-01-31")).toEqual(
      mockPlatformEffectiveness("all::2026-01-01::2026-01-31"),
    );
  });

  it("varies when the filter seed (company or date range) changes", () => {
    const allCompanies = mockPlatformEffectiveness("all::::");
    const oneCompany = mockPlatformEffectiveness("company-1::::");
    expect(allCompanies).not.toEqual(oneCompany);

    const rangeA = mockPlatformEffectiveness("all::2026-01-01::2026-01-31");
    const rangeB = mockPlatformEffectiveness("all::2026-02-01::2026-02-28");
    expect(rangeA).not.toEqual(rangeB);
  });

  it("returns the five PRD §2.3 metrics with stable keys", () => {
    const metrics = mockPlatformEffectiveness("all::::");
    expect(metrics.map((m) => m.key)).toEqual([
      "app-opens",
      "conversion-rate",
      "reviews-generated",
      "directions-requested",
      "tips-saved",
    ]);
    expect(metrics.find((m) => m.key === "conversion-rate")?.unit).toBe("%");
  });
});

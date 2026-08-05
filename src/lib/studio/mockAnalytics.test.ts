import { describe, expect, it } from "vitest";

import type { GuideRecord, RecommendationRecord } from "@/lib/data/types";

import {
  mockCompanyKpis,
  mockDelta,
  mockGuestActivity,
  mockGuideKpis,
  mockGuideLeaderboard,
  mockMostSavedTips,
} from "./mockAnalytics";

function guide(overrides: Partial<GuideRecord> = {}): GuideRecord {
  return {
    id: "guide-1",
    companyId: "company-1",
    name: "Jan",
    email: "jan@example.com",
    slug: "jan",
    avatarUrl: null,
    avatarInitial: "J",
    welcomeMessage: "Welcome!",
    status: "active",
    inviteToken: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function recommendation(overrides: Partial<RecommendationRecord> = {}): RecommendationRecord {
  return {
    id: "rec-1",
    companyId: "company-1",
    ownerType: "company",
    guideId: null,
    category: "coffee",
    name: "Coffee spot",
    area: "Center",
    address: "Somewhere 1",
    lng: 4.9,
    lat: 52.37,
    note: "Great coffee.",
    hours: "Daily 8-18",
    photos: [],
    visible: true,
    createdBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("mockDelta", () => {
  it("is deterministic for the same seed", () => {
    expect(mockDelta("company-1::opens")).toBe(mockDelta("company-1::opens"));
  });

  it("varies between different seeds", () => {
    // Not a hard guarantee for every possible pair, but true for these ids,
    // and a same-value regression would suggest the hash broke.
    expect(mockDelta("company-1")).not.toBe(mockDelta("company-2"));
  });
});

describe("mockCompanyKpis", () => {
  it("uses the real active-guide count and includes a delta on every item", () => {
    const kpis = mockCompanyKpis("company-1", 3);
    const activeGuides = kpis.find((k) => k.key === "active-guides");
    expect(activeGuides?.value).toBe(3);
    for (const kpi of kpis) {
      expect(typeof kpi.delta).toBe("number");
    }
    expect(kpis.map((k) => k.key)).toEqual([
      "active-guides",
      "app-opens",
      "tips-saved",
      "tours-booked",
    ]);
  });

  it("is deterministic for the same company id", () => {
    expect(mockCompanyKpis("company-1", 3)).toEqual(mockCompanyKpis("company-1", 3));
  });
});

describe("mockGuideKpis", () => {
  it("uses the real places count and leaves it without a delta", () => {
    const kpis = mockGuideKpis("guide-1", 7);
    const places = kpis.find((k) => k.key === "places");
    expect(places?.value).toBe(7);
    expect(places?.delta).toBeUndefined();
  });
});

describe("mockGuestActivity", () => {
  it("returns the requested number of points, each with a positive value", () => {
    const points = mockGuestActivity("company-1", 14);
    expect(points).toHaveLength(14);
    for (const point of points) {
      expect(point.value).toBeGreaterThan(0);
      expect(point.label.length).toBeGreaterThan(0);
    }
  });
});

describe("mockGuideLeaderboard", () => {
  it("carries over the real guide id and name", () => {
    const rows = mockGuideLeaderboard([guide({ id: "guide-1", name: "Jan" })]);
    expect(rows).toEqual([{ guideId: "guide-1", name: "Jan", tipsSaved: expect.any(Number) }]);
  });

  it("sorts by tips saved, descending", () => {
    const rows = mockGuideLeaderboard([
      guide({ id: "guide-a", name: "A" }),
      guide({ id: "guide-b", name: "B" }),
      guide({ id: "guide-c", name: "C" }),
    ]);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].tipsSaved).toBeGreaterThanOrEqual(rows[i].tipsSaved);
    }
  });
});

describe("mockMostSavedTips", () => {
  it("carries over the real recommendation id, name and category", () => {
    const rows = mockMostSavedTips([
      recommendation({ id: "rec-1", name: "Coffee spot", category: "coffee" }),
    ]);
    expect(rows).toEqual([
      { id: "rec-1", name: "Coffee spot", category: "coffee", saveCount: expect.any(Number) },
    ]);
  });

  it("sorts by save count, descending, and respects the limit", () => {
    const recs = Array.from({ length: 10 }, (_, i) =>
      recommendation({ id: `rec-${i}`, name: `Rec ${i}` }),
    );
    const rows = mockMostSavedTips(recs, 3);
    expect(rows).toHaveLength(3);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].saveCount).toBeGreaterThanOrEqual(rows[i].saveCount);
    }
  });

  it("never invents boat tours (recommendations are never category 'boats')", () => {
    const rows = mockMostSavedTips([recommendation({ category: "shop" })]);
    expect(rows[0].category).not.toBe("boats");
  });
});

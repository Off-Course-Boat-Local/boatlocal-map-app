// MOCK analytics generators — Studio Dashboard (PRD §7.1 company view /
// §6.4 guide view).
//
// No live analytics pipeline exists yet. src/lib/data/source.ts's
// getCompanyAnalyticsSummary / getGuideAnalyticsSummary are real, RLS-
// mirroring reads, but src/lib/data/fakeStore.ts seeds zero rows into
// `events` today, so every number they'd return right now is 0 — not
// useful for previewing what a KPI row, a chart, or a leaderboard actually
// look like with traffic. Everything in this file is a clearly-marked
// stand-in:
//
//   - deterministic, not Math.random() — seeded off a stable id (company,
//     guide, or recommendation id) so numbers don't jitter on every
//     render/build and so anything that snapshots them stays stable.
//   - shaped exactly like the props src/components/studio/dashboard/*.tsx
//     expect, so a real version is a drop-in replacement.
//
// TODO: once events are actually flowing, delete this file's call sites in
// src/app/studio/page.tsx and replace them with real aggregations. Note
// AnalyticsSummaryRow (src/lib/data/types.ts) only groups by
// eventType + guideId today — the per-day chart series and the
// per-recommendation save counts below need a new grouping (by day, by
// recommendationId) that doesn't exist in the data layer yet either.

import type {
  GuestActivityPoint,
  KpiItem,
  LeaderboardRow,
  MostSavedTipRow,
} from "@/components/studio/dashboard/types";
import type { GuideRecord, RecommendationRecord } from "@/lib/data/types";

const DEFAULT_DELTA_PERIOD_LABEL = "vs last 30 days";

/** Tiny deterministic string hash so mock numbers are stable across renders and builds instead of a fresh random value every request. */
function seededInt(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const span = max - min + 1;
  return min + (Math.abs(hash) % span);
}

/** MOCK: a plausible period-over-period delta, e.g. +18 or -6. */
export function mockDelta(seed: string): number {
  return seededInt(`${seed}::delta`, -12, 42);
}

/**
 * MOCK: company-level KPI row (PRD §7.1: active guides, app opens, tips
 * saved, tours booked — each with a delta). `activeGuides` is the one real
 * number passed in here — the rest have no event pipeline to sum yet.
 */
export function mockCompanyKpis(companyId: string, activeGuides: number): KpiItem[] {
  return [
    {
      key: "active-guides",
      label: "Active guides",
      value: activeGuides,
      delta: mockDelta(`${companyId}::guides`),
      deltaPeriodLabel: DEFAULT_DELTA_PERIOD_LABEL,
    },
    {
      key: "app-opens",
      label: "App opens",
      value: seededInt(`${companyId}::opens`, 180, 2400),
      delta: mockDelta(`${companyId}::opens`),
      deltaPeriodLabel: DEFAULT_DELTA_PERIOD_LABEL,
    },
    {
      key: "tips-saved",
      label: "Tips saved",
      value: seededInt(`${companyId}::saved`, 40, 620),
      delta: mockDelta(`${companyId}::saved`),
      deltaPeriodLabel: DEFAULT_DELTA_PERIOD_LABEL,
    },
    {
      key: "tours-booked",
      label: "Tours booked",
      value: seededInt(`${companyId}::booked`, 3, 58),
      delta: mockDelta(`${companyId}::booked`),
      deltaPeriodLabel: DEFAULT_DELTA_PERIOD_LABEL,
    },
  ];
}

/**
 * MOCK: guide-level KPI row (PRD §6.4: app opens, book-clicks, number of
 * places). `placesCount` is the one real number passed in here — the other
 * two need the same missing event pipeline.
 */
export function mockGuideKpis(guideId: string, placesCount: number): KpiItem[] {
  return [
    {
      key: "app-opens",
      label: "App opens",
      value: seededInt(`${guideId}::opens`, 20, 340),
      delta: mockDelta(`${guideId}::opens`),
      deltaPeriodLabel: DEFAULT_DELTA_PERIOD_LABEL,
    },
    {
      key: "book-clicks",
      label: "Book clicks",
      value: seededInt(`${guideId}::clicks`, 0, 40),
      delta: mockDelta(`${guideId}::clicks`),
      deltaPeriodLabel: DEFAULT_DELTA_PERIOD_LABEL,
    },
    {
      key: "places",
      label: "Places on your link",
      value: placesCount,
    },
  ];
}

/** MOCK: a 14-day guest-activity series for the dashboard chart. */
export function mockGuestActivity(companyId: string, days = 14): GuestActivityPoint[] {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    const dayKey = d.toISOString().slice(0, 10);
    return {
      label: d.toLocaleDateString("en-GB", { weekday: "short" }),
      value: seededInt(`${companyId}::activity::${dayKey}`, 8, 140),
    };
  });
}

/**
 * MOCK: per-guide "tips saved" counts for the leaderboard, keyed off real
 * guides so names/ids are correct even though the counts are stand-ins.
 */
export function mockGuideLeaderboard(guides: GuideRecord[]): LeaderboardRow[] {
  return guides
    .map((g) => ({
      guideId: g.id,
      name: g.name,
      tipsSaved: seededInt(`${g.id}::tipsSaved`, 2, 140),
    }))
    .sort((a, b) => b.tipsSaved - a.tipsSaved);
}

/**
 * MOCK: per-recommendation save counts for "most-saved tips", keyed off
 * real recommendations so names/categories are correct even though the
 * counts are stand-ins.
 */
export function mockMostSavedTips(
  recommendations: RecommendationRecord[],
  limit = 5,
): MostSavedTipRow[] {
  return recommendations
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      saveCount: seededInt(`${r.id}::saveCount`, 1, 95),
    }))
    .sort((a, b) => b.saveCount - a.saveCount)
    .slice(0, limit);
}

// MOCK platform-wide effectiveness numbers — Admin > Guides and Admin >
// Platform analytics (PRD §2.3's "effectiveness dashboard for Admin" /
// §8.3's per-guide performance / §8.4).
//
// Real wiring already exists for both pages: getGuidesForCompany +
// getPlatformAnalyticsSummary (src/lib/data/source.ts) are real,
// RLS-mirroring reads. But src/lib/data/fakeStore.ts seeds zero rows into
// `events`, so every one of PRD §2.3's metrics (app opens, book-click ->
// booking conversion, reviews generated, directions requested, tips saved)
// would read 0 today — not useful for previewing what these two pages
// actually look like with real traffic. This file is a clearly-marked
// stand-in, mirroring src/lib/studio/mockAnalytics.ts's approach:
//
//   - deterministic, not Math.random() — seeded off a stable string (a
//     guide id, or the platform analytics page's own filter state) so
//     numbers don't jitter on every render/build.
//   - the platform summary is seeded off the *filter state* (company +
//     date range) specifically so that Admin > Platform analytics' date
//     range and company filters visibly do something even before real
//     event volume exists — changing a filter changes the seed, which
//     changes the numbers, in a stable and repeatable way.
//   - shaped exactly like PRD §2.3's metric list / the guide performance
//     columns already shown in Studio > Guides
//     (src/app/studio/guides/page.tsx), so a real aggregation is a
//     drop-in replacement later.
//
// TODO: once events are actually flowing at volume, delete this file's call
// sites in src/app/admin/(protected)/guides/page.tsx and
// src/app/admin/(protected)/analytics/page.tsx and replace with real
// aggregations over `events` (e.g. supabase.rpc('admin_effectiveness_summary', ...)).

/** Tiny deterministic string hash so mock numbers are stable across renders and builds instead of a fresh random value every request. */
function seededInt(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const span = max - min + 1;
  return min + (Math.abs(hash) % span);
}

export interface GuidePerformance {
  appOpens: number;
  tipsSaved: number;
  bookClicks: number;
}

/**
 * MOCK: a single guide's performance row for Admin > Guides (PRD §8.3).
 * Seeded off the guide's own id, matching src/lib/studio/mockAnalytics.ts's
 * mockGuideKpis ranges so the same guide reads similarly whether viewed from
 * Studio or from Admin.
 */
export function mockGuidePerformance(guideId: string): GuidePerformance {
  return {
    appOpens: seededInt(`${guideId}::admin::opens`, 20, 500),
    tipsSaved: seededInt(`${guideId}::admin::saved`, 2, 140),
    bookClicks: seededInt(`${guideId}::admin::clicks`, 0, 40),
  };
}

export interface CompanyPerformance {
  appOpens: number;
  tipsSaved: number;
  bookClicks: number;
}

/**
 * MOCK: a single company's performance row for Admin > Companies (PRD
 * §8.3's "per-company performance"). Same shape and same reasoning as
 * mockGuidePerformance above (fakeStore seeds zero events, so a real
 * aggregation would read 0 for almost every tenant today) — seeded off the
 * company's own id so a given company reads the same numbers across
 * renders/builds, and differently from every other company.
 *
 * TODO: once events are actually flowing at volume, delete this function's
 * call site in src/app/admin/(protected)/companies/page.tsx and replace
 * with a real aggregation over `events` (getCompanyAnalyticsSummary in
 * src/lib/data/source.ts already exists for this and needs no further
 * backend work — it's the mock data, not the read path, standing in here).
 */
export function mockCompanyPerformance(companyId: string): CompanyPerformance {
  return {
    appOpens: seededInt(`${companyId}::admin::opens`, 50, 4000),
    tipsSaved: seededInt(`${companyId}::admin::saved`, 10, 900),
    bookClicks: seededInt(`${companyId}::admin::clicks`, 0, 300),
  };
}

export interface EffectivenessMetric {
  key: string;
  label: string;
  value: number;
  /** Unit suffix, e.g. "%" for the conversion rate. */
  unit?: string;
}

/**
 * MOCK: the PRD §2.3 "supporting metrics" row for Admin > Platform
 * analytics, seeded off the page's current filter state (see this file's
 * header comment for why). `seed` should combine the selected company id
 * (or "all") with the selected date range so switching either filter
 * produces a different, but stable, set of numbers.
 */
export function mockPlatformEffectiveness(seed: string): EffectivenessMetric[] {
  return [
    { key: "app-opens", label: "App opens", value: seededInt(`${seed}::opens`, 400, 12000) },
    {
      key: "conversion-rate",
      label: "Book-click → booking conversion",
      value: seededInt(`${seed}::conversion`, 4, 22),
      unit: "%",
    },
    {
      key: "reviews-generated",
      label: "Reviews generated",
      value: seededInt(`${seed}::reviews`, 20, 900),
    },
    {
      key: "directions-requested",
      label: "Directions requested",
      value: seededInt(`${seed}::directions`, 100, 5000),
    },
    { key: "tips-saved", label: "Tips saved", value: seededInt(`${seed}::saved`, 200, 8000) },
  ];
}

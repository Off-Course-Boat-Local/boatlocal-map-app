// Real Studio Dashboard aggregations over `events` (PRD §7.1 company view /
// §6.4 guide view) — the replacement for src/lib/studio/mockAnalytics.ts's
// KPI and leaderboard generators now that guest event tracking actually
// writes rows (see src/components/guest/*.tsx's recordGuestEvent call
// sites) and src/lib/data/source.ts's getCompanyAnalyticsSummary /
// getGuideAnalyticsSummary can sum them per-tenant.
//
// This mirrors the sum()-over-AnalyticsSummaryRow pattern
// src/lib/admin/analytics.ts already uses for the same `events` table, but
// is kept as Studio's own copy rather than imported from there — this
// repo's convention is Studio code never depends on src/lib/admin/** (a
// different, off-limits work-stream), even though the underlying pattern is
// identical.
//
// There is no period-over-period comparison data source anywhere in the
// schema, so unlike mockAnalytics.ts's fabricated deltas, KpiItem.delta is
// deliberately never set here — KpiCard already treats it as optional.

import type { KpiItem, LeaderboardRow } from "@/components/studio/dashboard/types";
import type { AnalyticsSummaryRow, EventType, GuideRecord } from "@/lib/data/types";

function sum(rows: AnalyticsSummaryRow[], types: EventType[]): number {
  return rows.reduce((total, row) => (types.includes(row.eventType) ? total + row.count : total), 0);
}

/**
 * Company-level KPI row (PRD §7.1: active guides, app opens, tips saved,
 * tours booked). `activeGuides` is passed in rather than derived here since
 * it comes from the guide list, not the events table. "Tours booked" sums
 * `booking_outcome` — the closest real equivalent the event schema has to
 * the PRD's phrasing; there's no separate "confirmed booking" event type.
 */
export function companyDashboardKpis(rows: AnalyticsSummaryRow[], activeGuides: number): KpiItem[] {
  return [
    { key: "active-guides", label: "Active guides", value: activeGuides },
    { key: "app-opens", label: "App opens", value: sum(rows, ["app_open"]) },
    { key: "tips-saved", label: "Tips saved", value: sum(rows, ["tip_saved"]) },
    { key: "tours-booked", label: "Tours booked", value: sum(rows, ["booking_outcome"]) },
  ];
}

/**
 * Guide-level KPI row (PRD §6.4: app opens, book-clicks, number of places).
 * `placesCount` is passed in rather than derived here since it comes from
 * the recommendation list, not the events table.
 */
export function guideDashboardKpis(rows: AnalyticsSummaryRow[], placesCount: number): KpiItem[] {
  return [
    { key: "app-opens", label: "App opens", value: sum(rows, ["app_open"]) },
    { key: "book-clicks", label: "Book clicks", value: sum(rows, ["boat_book_click"]) },
    { key: "places", label: "Places on your link", value: placesCount },
  ];
}

/**
 * Per-guide "tips saved" leaderboard (PRD §7.1), sorted descending. Every
 * guide passed in appears, including ones with zero saves — same as
 * src/app/studio/(protected)/guides/page.tsx's statsByGuide — so a
 * brand-new company with guides but no traffic shows real 0s rather than an
 * empty list.
 */
export function guideTipsLeaderboard(
  rows: AnalyticsSummaryRow[],
  guides: GuideRecord[],
): LeaderboardRow[] {
  const tipsSavedByGuide = new Map<string, number>();
  for (const row of rows) {
    if (!row.guideId || row.eventType !== "tip_saved") continue;
    tipsSavedByGuide.set(row.guideId, (tipsSavedByGuide.get(row.guideId) ?? 0) + row.count);
  }

  return guides
    .map((g) => ({ guideId: g.id, name: g.name, tipsSaved: tipsSavedByGuide.get(g.id) ?? 0 }))
    .sort((a, b) => b.tipsSaved - a.tipsSaved);
}

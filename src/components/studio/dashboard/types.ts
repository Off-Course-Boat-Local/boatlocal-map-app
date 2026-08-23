// Shared prop shapes for the Studio Dashboard's presentational components
// (PRD §7.1 company view / §6.4 guide view).
//
// Every component in this folder takes its numbers through these plain
// props — none of them fetch anything themselves. src/app/studio/page.tsx
// fills these in with real aggregations from src/lib/studio/
// dashboardAnalytics.ts. Wiring in a new aggregation later (e.g. the
// day-by-day / per-recommendation groupings that don't exist yet — see
// that page's header comment) means changing what page.tsx passes in,
// never these shapes or components.

export interface KpiItem {
  key: string;
  label: string;
  value: number;
  /**
   * Percentage change vs. the previous period, e.g. 12 => "+12%", -4 =>
   * "-4%". Omit when there is no meaningful comparison (e.g. a guide's
   * current place count, or any KPI today — no period-over-period data
   * source exists yet).
   */
  delta?: number;
  /** e.g. "vs last 30 days". Only shown alongside a delta. */
  deltaPeriodLabel?: string;
}

export interface LeaderboardRow {
  guideId: string;
  name: string;
  tipsSaved: number;
}

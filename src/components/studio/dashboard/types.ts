// Shared prop shapes for the Studio Dashboard's presentational components
// (PRD §7.1 company view / §6.4 guide view).
//
// Every component in this folder takes its numbers through these plain
// props — none of them fetch anything themselves. Today
// src/app/studio/page.tsx fills most of these in with MOCK generators from
// src/lib/studio/mockAnalytics.ts (no live analytics pipeline exists yet;
// see that file's header comment). Wiring in real aggregations later means
// changing what page.tsx passes in, never these shapes or components.

import type { CategoryId } from "@/lib/types";

export interface KpiItem {
  key: string;
  label: string;
  value: number;
  /**
   * Percentage change vs. the previous period, e.g. 12 => "+12%", -4 =>
   * "-4%". Omit when there is no meaningful comparison (e.g. a guide's
   * current place count).
   */
  delta?: number;
  /** e.g. "vs last 30 days". Only shown alongside a delta. */
  deltaPeriodLabel?: string;
}

export interface GuestActivityPoint {
  /** Short axis label, e.g. "Mon" or "Aug 1". */
  label: string;
  value: number;
}

export interface LeaderboardRow {
  guideId: string;
  name: string;
  tipsSaved: number;
}

export interface MostSavedTipRow {
  id: string;
  name: string;
  category: CategoryId;
  saveCount: number;
}

// Real platform/company/guide aggregations over `events` — the replacement
// for the former src/lib/admin/mockAnalytics.ts, whose own TODO called for
// this once event volume existed.
//
// Everything here reads through src/lib/data/source.ts's
// getPlatformAnalyticsSummary / getCompanyAnalyticsSummary /
// getGuideAnalyticsSummary, which call the `security invoker` RPCs in
// 20260805063612_helper_functions.sql. Security invoker matters: those
// functions return only what the CALLER's own RLS on `events` already
// permits, so this module cannot widen anyone's visibility just by being
// admin-side code. It still passes ADMIN_ACTOR through, and source.ts
// re-checks the role — the same layered posture as everywhere else.
//
// The shapes below intentionally match the mock's exports (GuidePerformance,
// CompanyPerformance, EffectivenessMetric) so the swap needed no changes to
// the pages' rendering, only to where the numbers come from.

import {
  getCompanyAnalyticsSummary,
  getGuideAnalyticsSummary,
  getPlatformAnalyticsSummary,
} from "@/lib/data/source";
import type { AnalyticsRange, AnalyticsSummaryRow, EventType } from "@/lib/data/types";

import { ADMIN_ACTOR } from "./actor";

/**
 * PRD §5.6 defines two separate review flows plus private feedback; "reviews
 * generated" is the sum of all three, since from the platform's point of
 * view each is one review the guest was prompted into leaving.
 */
const REVIEW_EVENTS: EventType[] = [
  "review_click_google",
  "review_click_tripadvisor",
  "review_private_feedback",
];

function sum(rows: AnalyticsSummaryRow[], types: EventType[]): number {
  return rows.reduce((total, row) => (types.includes(row.eventType) ? total + row.count : total), 0);
}

export interface GuidePerformance {
  appOpens: number;
  tipsSaved: number;
  bookClicks: number;
}

export type CompanyPerformance = GuidePerformance;

export async function guidePerformance(
  guideId: string,
  range?: AnalyticsRange,
): Promise<GuidePerformance> {
  const rows = await getGuideAnalyticsSummary(ADMIN_ACTOR, guideId, range);
  return {
    appOpens: sum(rows, ["app_open"]),
    tipsSaved: sum(rows, ["tip_saved"]),
    bookClicks: sum(rows, ["boat_book_click"]),
  };
}

export async function companyPerformance(
  companyId: string,
  range?: AnalyticsRange,
): Promise<CompanyPerformance> {
  const rows = await getCompanyAnalyticsSummary(ADMIN_ACTOR, companyId, range);
  return {
    appOpens: sum(rows, ["app_open"]),
    tipsSaved: sum(rows, ["tip_saved"]),
    bookClicks: sum(rows, ["boat_book_click"]),
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
 * PRD §2.3's supporting-metrics row for Admin > Platform analytics.
 *
 * `companyId` narrows to one tenant; omitting it sums every company the
 * caller can see.
 */
export async function platformEffectiveness(
  range?: AnalyticsRange,
  companyId?: string,
): Promise<EffectivenessMetric[]> {
  const platformRows = await getPlatformAnalyticsSummary(ADMIN_ACTOR, range);
  const scoped = companyId ? platformRows.filter((r) => r.companyId === companyId) : platformRows;

  // getPlatformAnalyticsSummary returns AnalyticsSummaryRow plus company
  // fields; sum() only reads eventType/count, so the extra fields are inert.
  const rows: AnalyticsSummaryRow[] = scoped;

  const bookClicks = sum(rows, ["boat_book_click"]);
  const bookings = sum(rows, ["booking_outcome"]);

  return [
    { key: "app-opens", label: "App opens", value: sum(rows, ["app_open"]) },
    {
      key: "conversion-rate",
      label: "Book-click → booking conversion",
      // Guard the divide: zero clicks is a real state (a brand-new tenant),
      // and NaN% renders as literal "NaN%" rather than an empty metric.
      value: bookClicks === 0 ? 0 : Math.round((bookings / bookClicks) * 100),
      unit: "%",
    },
    { key: "reviews-generated", label: "Reviews generated", value: sum(rows, REVIEW_EVENTS) },
    {
      key: "directions-requested",
      label: "Directions requested",
      value: sum(rows, ["directions_requested"]),
    },
    { key: "tips-saved", label: "Tips saved", value: sum(rows, ["tip_saved"]) },
  ];
}

// Pure parsing for Admin > Platform analytics' date-range filter
// (?from=&to= query params, from a plain <input type="date"> GET form —
// see src/app/admin/(protected)/analytics/page.tsx). Kept separate from the
// page component so it's trivially unit-testable, matching the convention
// of e.g. src/lib/studio/campaignParams.ts.

import type { AnalyticsRange } from "@/lib/data/types";

export interface DateRangeParams {
  from?: string;
  to?: string;
}

/**
 * Parses `from`/`to` query params into an `AnalyticsRange` for
 * `getPlatformAnalyticsSummary` (src/lib/data/source.ts). Missing or
 * unparsable bounds are dropped rather than thrown — a bad or absent date in
 * the URL should widen the range, not break the page. Returns `undefined`
 * (meaning "all time") only when neither bound parses, matching
 * `getPlatformAnalyticsSummary`'s own `range?: AnalyticsRange` contract.
 *
 * `to` is treated as an inclusive calendar day, matching what a
 * `<input type="date">` value means to a person filling it in:
 * `getPlatformAnalyticsSummary`'s `inRange()` compares
 * `occurredAt < range.to`, so the parsed bound is pushed to the start of the
 * next day to include every event that happened *on* the selected day.
 */
export function parseDateRangeParams({ from, to }: DateRangeParams): AnalyticsRange | undefined {
  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;
  const validFrom = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : undefined;
  const validTo = toDate && !Number.isNaN(toDate.getTime()) ? toDate : undefined;

  if (!validFrom && !validTo) return undefined;

  const rangeFrom = validFrom ?? new Date(0);
  const rangeTo = validTo
    ? new Date(validTo.getTime() + 24 * 60 * 60 * 1000)
    : new Date(8640000000000000); // Date's max value — "no upper bound" without going back to undefined.

  return { from: rangeFrom, to: rangeTo };
}

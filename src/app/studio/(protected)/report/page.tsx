// Report — company only (PRD §7.7). 100% Live database analytics queried
// from the `events` table via RPC company_analytics_summary for this company.

import DownloadCsvButton from "@/components/studio/DownloadCsvButton";
import { PageHeader, SectionHeading, TableShell } from "@/components/studio/primitives";
import { getCompanyAnalyticsSummary, getGuidesForCompany } from "@/lib/data/source";
import type { AnalyticsRange, AnalyticsSummaryRow, EventType } from "@/lib/data/types";
import { toCsv } from "@/lib/studio/csv";
import { actorFromSession, requireCompanyRole, requireDevSession } from "@/lib/studio/devAuth";

interface MetricDefinition {
  metric: string;
  types: EventType[];
}

const METRICS: MetricDefinition[] = [
  { metric: "App opens", types: ["app_open"] },
  { metric: "Places & tips viewed", types: ["tip_viewed"] },
  { metric: "Directions requested", types: ["directions_requested"] },
  { metric: "Boat tour booking clicks", types: ["boat_book_click"] },
  { metric: "Review link clicks", types: ["review_click_google", "review_click_tripadvisor", "review_private_feedback"] },
  { metric: "Places saved by guests", types: ["tip_saved"] },
];

function sumEvents(rows: AnalyticsSummaryRow[], types: EventType[]): number {
  return rows.reduce(
    (total, row) => (types.includes(row.eventType) ? total + row.count : total),
    0,
  );
}

function percentChange(current: number, previous: number): string {
  if (previous === 0) {
    return current === 0 ? "0%" : `+${current > 0 ? "100%" : "0%"}`;
  }
  const pct = ((current - previous) / previous) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

export default async function StudioReportPage() {
  const session = await requireDevSession();
  requireCompanyRole(session);
  const actor = actorFromSession(session);

  const now = Date.now();
  const currentRange: AnalyticsRange = {
    from: new Date(now - 30 * 86400000),
    to: new Date(now),
  };
  const previousRange: AnalyticsRange = {
    from: new Date(now - 60 * 86400000),
    to: new Date(now - 30 * 86400000),
  };

  const [currentRows, previousRows, allTimeRows, guides] = await Promise.all([
    getCompanyAnalyticsSummary(actor, session.companyId, currentRange),
    getCompanyAnalyticsSummary(actor, session.companyId, previousRange),
    getCompanyAnalyticsSummary(actor, session.companyId),
    getGuidesForCompany(actor, session.companyId),
  ]);

  const guideNameById = new Map(guides.map((g) => [g.id, g.name]));

  const periodComparison = METRICS.map(({ metric, types }) => {
    const current = sumEvents(currentRows, types);
    const previous = sumEvents(previousRows, types);
    return {
      metric,
      current,
      previous,
      change: percentChange(current, previous),
    };
  });

  const totalAllTime = allTimeRows.reduce((sum, row) => sum + row.count, 0);

  const csv = toCsv(periodComparison, [
    { header: "Metric", value: (r) => r.metric },
    { header: "Last 30 Days", value: (r) => r.current },
    { header: "Previous 30 Days", value: (r) => r.previous },
    { header: "Change", value: (r) => r.change },
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Report"
        description="Live guest engagement trends: Last 30 days vs. previous 30 days."
      />

      <section>
        <SectionHeading
          title="Performance summary (Live Database)"
          description="Aggregated from guest app interactions across all company links."
          action={<DownloadCsvButton csv={csv} filename="boatlocal-report.csv" />}
        />

        <TableShell
          head={
            <>
              <th>Metric</th>
              <th>Last 30 days</th>
              <th>Previous 30 days</th>
              <th>Period Change</th>
            </>
          }
        >
          {periodComparison.map((row) => (
            <tr key={row.metric}>
              <td className="font-semibold text-[var(--studio-ink)]">{row.metric}</td>
              <td className="tabular-nums font-bold text-[var(--studio-ink)]">{row.current}</td>
              <td className="tabular-nums text-[var(--studio-ink-soft)]">{row.previous}</td>
              <td className="tabular-nums font-medium text-[var(--studio-ink-soft)]">
                {row.change}
              </td>
            </tr>
          ))}
        </TableShell>
      </section>

      <section>
        <SectionHeading
          title="Guide engagement breakdown (All time)"
          description={`${totalAllTime} total event${totalAllTime === 1 ? "" : "s"} tracked across your guides.`}
        />

        <TableShell
          head={
            <>
              <th>Event type</th>
              <th>Attributed Guide</th>
              <th>Total Count</th>
            </>
          }
        >
          {allTimeRows.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-6 text-center text-sm text-[var(--studio-ink-soft)]">
                No events recorded yet. Share your links with guests to start seeing live data!
              </td>
            </tr>
          ) : (
            allTimeRows.map((row, i) => (
              <tr key={`${row.eventType}-${row.guideId ?? "company"}-${i}`}>
                <td className="font-mono text-xs text-[var(--studio-ink)]">{row.eventType}</td>
                <td className="text-sm text-[var(--studio-ink-soft)]">
                  {row.guideId ? guideNameById.get(row.guideId) ?? row.guideId : "Direct / Company link"}
                </td>
                <td className="tabular-nums font-bold text-[var(--studio-ink)]">{row.count}</td>
              </tr>
            ))
          )}
        </TableShell>
      </section>
    </div>
  );
}

// Report — company only (PRD §7.7). A guide's equivalent is the "Your
// stats" table on their Dashboard (src/app/studio/(protected)/page.tsx),
// scoped to just their own numbers.

import DownloadCsvButton from "@/components/studio/DownloadCsvButton";
import { PageHeader, SectionHeading, TableShell } from "@/components/studio/primitives";
import { getCompanyAnalyticsSummary } from "@/lib/data/source";
import { toCsv } from "@/lib/studio/csv";
import { actorFromSession, requireCompanyRole, requireDevSession } from "@/lib/studio/devAuth";

/**
 * Placeholder period-over-period figures. Real event volume in the fake
 * store is currently near-zero (see the "Raw event counts" section below,
 * which IS wired to getCompanyAnalyticsSummary) — not enough to make a
 * meaningful trend table yet. getCompanyAnalyticsSummary already accepts an
 * `AnalyticsRange`, so swapping these for two real calls (this 30-day window
 * vs. the 30 days before it) is a like-for-like replacement once there's
 * enough traffic for the comparison to mean anything.
 */
const PLACEHOLDER_PERIOD_ROWS: Array<{ metric: string; current: number; previous: number }> = [
  { metric: "App opens", current: 482, previous: 401 },
  { metric: "Tips viewed", current: 1893, previous: 1622 },
  { metric: "Directions requested", current: 214, previous: 198 },
  { metric: "Boat tour booking clicks", current: 37, previous: 25 },
  { metric: "Review link clicks", current: 19, previous: 14 },
];

function percentChange(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "0%" : "+∞%";
  const pct = ((current - previous) / previous) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

export default async function StudioReportPage() {
  const session = await requireDevSession();
  requireCompanyRole(session);
  const actor = actorFromSession(session);

  const rows = await getCompanyAnalyticsSummary(actor, session.companyId);
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  const csv = toCsv(PLACEHOLDER_PERIOD_ROWS, [
    { header: "Metric", value: (r) => r.metric },
    { header: "This period", value: (r) => r.current },
    { header: "Previous period", value: (r) => r.previous },
    { header: "Change", value: (r) => percentChange(r.current, r.previous) },
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title="Report" description="Last 30 days vs. the 30 days before that." />

      <section>
        <SectionHeading
          title="Performance summary"
          description={
            <>
              Placeholder figures until there is enough real event volume to compare period over
              period — see the comment on <code>PLACEHOLDER_PERIOD_ROWS</code> in this page for the
              swap-in.
            </>
          }
          action={<DownloadCsvButton csv={csv} filename="boatlocal-report.csv" />}
        />

        <TableShell
          head={
            <>
              <th>Metric</th>
              <th>This period</th>
              <th>Previous period</th>
              <th>Change</th>
            </>
          }
        >
          {PLACEHOLDER_PERIOD_ROWS.map((row) => (
            <tr key={row.metric}>
              <td className="font-medium text-[var(--studio-ink)]">{row.metric}</td>
              <td className="tabular-nums text-[var(--studio-ink-soft)]">{row.current}</td>
              <td className="tabular-nums text-[var(--studio-ink-soft)]">{row.previous}</td>
              <td className="tabular-nums text-[var(--studio-ink-soft)]">
                {percentChange(row.current, row.previous)}
              </td>
            </tr>
          ))}
        </TableShell>
      </section>

      <section>
        <SectionHeading
          title="Raw event counts (real data)"
          description={`${total} event${total === 1 ? "" : "s"} recorded across every guide, unfiltered.`}
        />

        <TableShell
          head={
            <>
              <th>Event</th>
              <th>Guide</th>
              <th>Count</th>
            </>
          }
        >
          {rows.map((row) => (
            <tr key={`${row.eventType}::${row.guideId ?? ""}`}>
              <td className="font-medium text-[var(--studio-ink)]">{row.eventType}</td>
              <td className="text-[var(--studio-ink-soft)]">{row.guideId ?? "—"}</td>
              <td className="tabular-nums text-[var(--studio-ink-soft)]">{row.count}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="text-[var(--studio-ink-soft)]" colSpan={3}>
                No events recorded yet.
              </td>
            </tr>
          ) : null}
        </TableShell>
      </section>
    </div>
  );
}

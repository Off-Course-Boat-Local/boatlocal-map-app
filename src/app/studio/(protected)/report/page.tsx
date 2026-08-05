// Report — company only (PRD §7.7). A guide's equivalent is Link & QR /
// Stats (src/app/studio/link-qr), scoped to just their own numbers.

import DownloadCsvButton from "@/components/studio/DownloadCsvButton";
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
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Report</h1>
        <p className="mt-1 text-sm text-neutral-500">Last 30 days vs. the 30 days before that.</p>
      </div>

      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Performance summary
          </h2>
          <DownloadCsvButton csv={csv} filename="boatlocal-report.csv" />
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Placeholder figures until there is enough real event volume to compare period over
          period — see the comment on <code>PLACEHOLDER_PERIOD_ROWS</code> in this page for the
          swap-in.
        </p>

        <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Metric</th>
                <th className="px-4 py-2 font-medium">This period</th>
                <th className="px-4 py-2 font-medium">Previous period</th>
                <th className="px-4 py-2 font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {PLACEHOLDER_PERIOD_ROWS.map((row) => (
                <tr key={row.metric} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2 text-neutral-900">{row.metric}</td>
                  <td className="px-4 py-2 text-neutral-600">{row.current}</td>
                  <td className="px-4 py-2 text-neutral-600">{row.previous}</td>
                  <td className="px-4 py-2 text-neutral-600">
                    {percentChange(row.current, row.previous)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Raw event counts (real data)
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          {total} event{total === 1 ? "" : "s"} recorded across every guide, unfiltered.
        </p>

        <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Event</th>
                <th className="px-4 py-2 font-medium">Guide</th>
                <th className="px-4 py-2 font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.eventType}::${row.guideId ?? ""}`}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-4 py-2 text-neutral-900">{row.eventType}</td>
                  <td className="px-4 py-2 text-neutral-600">{row.guideId ?? "—"}</td>
                  <td className="px-4 py-2 text-neutral-600">{row.count}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-neutral-500" colSpan={3}>
                    No events recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// Studio Dashboard — the one page both roles land on after sign-in
// (PRD §7.1 company view / §6.4 guide view — same route, different content
// by role).
//
// Every number on this page is real, read through src/lib/data/source.ts's
// getCompanyAnalyticsSummary / getGuideAnalyticsSummary (RLS-mirroring
// reads over `events`) and summed in src/lib/studio/dashboardAnalytics.ts.
// A brand-new company/guide with zero events shows real 0s and honest
// empty states, never a plausible-looking placeholder — this page used to
// lean on src/lib/studio/mockAnalytics.ts for exactly that shortcut, which
// is why it existed and why it's gone now.
//
// Two things PRD §7.1 asks for — a day-by-day guest-activity chart and a
// most-saved-tips ranking — are NOT shown here: AnalyticsSummaryRow only
// groups by eventType + guideId today, and neither a by-day nor a
// by-recommendation grouping exists in the data layer yet. Rather than
// fabricate one or silently render an empty chart, this page says so
// plainly (see the note below the leaderboard) until that aggregation
// exists for real.
//
// Every display component (src/components/studio/dashboard/*.tsx) takes
// its numbers through plain props, so wiring in the missing groupings later
// means changing what this page passes in, not those components.

import CompanyPublishToggle from "@/components/studio/CompanyPublishToggle";
import GuideLeaderboard from "@/components/studio/dashboard/GuideLeaderboard";
import KpiRow from "@/components/studio/dashboard/KpiRow";
import {
  getCompanyAnalyticsSummary,
  getCompanyForStudio,
  getGuideAnalyticsSummary,
  getGuidesForCompany,
  getRecommendationsForStudio,
} from "@/lib/data/source";
import {
  companyDashboardKpis,
  guideDashboardKpis,
  guideTipsLeaderboard,
} from "@/lib/studio/dashboardAnalytics";
import { actorFromSession, requireDevSession } from "@/lib/studio/devAuth";

export default async function StudioDashboardPage() {
  const session = await requireDevSession();
  const actor = actorFromSession(session);

  const recommendations = await getRecommendationsForStudio(actor);

  if (session.role === "company") {
    const [guides, company, analytics] = await Promise.all([
      getGuidesForCompany(actor, session.companyId),
      getCompanyForStudio(actor, session.companyId),
      getCompanyAnalyticsSummary(actor, session.companyId),
    ]);
    const activeGuides = guides.filter((g) => g.status === "active").length;

    const kpis = companyDashboardKpis(analytics, activeGuides);
    const leaderboard = guideTipsLeaderboard(analytics, guides);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">{session.companyName}</p>
        </div>

        {company ? (
          <CompanyPublishToggle companyId={company.id} status={company.status} />
        ) : null}

        <div className="space-y-6">
          <KpiRow items={kpis} />
          <GuideLeaderboard rows={leaderboard} />
        </div>

        <p className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
          Day-by-day guest activity and a most-saved-tips ranking
          aren&rsquo;t available yet — the totals above are real, but there
          isn&rsquo;t a day-level or per-tip breakdown in the data layer
          today. Nothing to show here yet.
        </p>
      </div>
    );
  }

  // guide
  const ownRecommendations = recommendations.filter(
    (r) => r.ownerType === "guide" && r.guideId === session.guideId,
  );
  const analytics = await getGuideAnalyticsSummary(actor, session.guideId);
  const kpis = guideDashboardKpis(analytics, recommendations.length);
  const totalEvents = analytics.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {session.guideName} &middot; {session.companyName}
        </p>
      </div>

      <KpiRow items={kpis} />

      <p className="text-sm text-neutral-500">
        {ownRecommendations.length} of your own picks, plus the base list
        (read-only to you). See Recommendations for the full list, and
        Profile for your own share link.
      </p>

      {/* Moved here from the old combined "Link & QR / Stats" tab when
          Profile and Settings were split apart. This breaks the same two
          numbers as the KPI cards above down by every event type your link
          records, not just app opens and book-clicks. */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Your stats</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Real event counts from your own link, broken down by type.
        </p>
        <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Event</th>
                <th className="px-4 py-2 font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {analytics.map((row) => (
                <tr key={row.eventType} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2 text-neutral-900">{row.eventType}</td>
                  <td className="px-4 py-2 text-neutral-600">{row.count}</td>
                </tr>
              ))}
              {analytics.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-neutral-500" colSpan={2}>
                    No events recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <p className="border-t border-neutral-200 px-4 py-2 text-xs text-neutral-500">
            {totalEvents} event{totalEvents === 1 ? "" : "s"} total.
          </p>
        </div>
      </div>
    </div>
  );
}

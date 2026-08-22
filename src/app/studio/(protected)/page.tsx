// Studio Dashboard — the one page both roles land on after sign-in
// (PRD §7.1 company view / §6.4 guide view — same route, different content
// by role).
//
// KPI values, the guest-activity chart, and both leaderboard-style lists
// are MOCK numbers — see src/lib/studio/mockAnalytics.ts's header comment
// for why (no live analytics pipeline exists yet; the fake store seeds
// zero rows into `events`). Anything the data layer can already answer for
// real — active guide count, guide names/ids, recommendation names/ids/
// categories, a guide's own place count — comes straight from
// src/lib/data/source.ts, and the mock generators are keyed off those real
// records so names line up even though the counts next to them are
// placeholders.
//
// Every display component (src/components/studio/dashboard/*.tsx) takes
// its numbers through plain props, so wiring in a real analytics pipeline
// later means changing what this page passes in, not those components.

import GuestActivityChart from "@/components/studio/dashboard/GuestActivityChart";
import GuideLeaderboard from "@/components/studio/dashboard/GuideLeaderboard";
import KpiRow from "@/components/studio/dashboard/KpiRow";
import MostSavedTips from "@/components/studio/dashboard/MostSavedTips";
import StudioBrandScope from "@/components/studio/StudioBrandScope";
import {
  getGuideAnalyticsSummary,
  getGuidesForCompany,
  getRecommendationsForStudio,
} from "@/lib/data/source";
import { actorFromSession, requireDevSession } from "@/lib/studio/devAuth";
import {
  mockCompanyKpis,
  mockGuestActivity,
  mockGuideKpis,
  mockGuideLeaderboard,
  mockMostSavedTips,
} from "@/lib/studio/mockAnalytics";

export default async function StudioDashboardPage() {
  const session = await requireDevSession();
  const actor = actorFromSession(session);

  const recommendations = await getRecommendationsForStudio(actor);

  if (session.role === "company") {
    const guides = await getGuidesForCompany(actor, session.companyId);
    const activeGuides = guides.filter((g) => g.status === "active").length;

    const kpis = mockCompanyKpis(session.companyId, activeGuides);
    const activity = mockGuestActivity(session.companyId);
    const leaderboard = mockGuideLeaderboard(guides);
    const mostSaved = mockMostSavedTips(recommendations);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">{session.companyName}</p>
        </div>

        <StudioBrandScope>
          <div className="space-y-6">
            <KpiRow items={kpis} />
            <GuestActivityChart data={activity} />
            <div className="grid gap-6 lg:grid-cols-2">
              <GuideLeaderboard rows={leaderboard} />
              <MostSavedTips rows={mostSaved} />
            </div>
          </div>
        </StudioBrandScope>

        <p className="text-sm text-neutral-500">
          The numbers above are placeholders until real guest traffic flows in
          — see the Report tab for real event counts, and Recommendations to
          review the base list and every guide&rsquo;s own picks.
        </p>
      </div>
    );
  }

  // guide
  const ownRecommendations = recommendations.filter(
    (r) => r.ownerType === "guide" && r.guideId === session.guideId,
  );
  const kpis = mockGuideKpis(session.guideId, recommendations.length);
  // Real, unlike the KPI cards above — see "Your stats" below for why the
  // two sit side by side rather than being blended into one row.
  const analytics = await getGuideAnalyticsSummary(actor, session.guideId);
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
        (read-only to you). App opens and book-clicks above are placeholders
        until real traffic flows in. See Recommendations for the full list,
        and Profile for your own share link.
      </p>

      {/* Moved here from the old combined "Link & QR / Stats" tab when
          Profile and Settings were split apart — this is the ONE section on
          this page that is not a placeholder, so it's labelled as such
          rather than left to look like it belongs with the mock KPIs above. */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Your stats</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Real event counts from your own link — unlike the cards above, these
          are live today.
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

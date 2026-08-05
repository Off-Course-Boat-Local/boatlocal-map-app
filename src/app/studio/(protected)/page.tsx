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
import { getGuidesForCompany, getRecommendationsForStudio } from "@/lib/data/source";
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
        and Link &amp; QR / Stats for your own share link.
      </p>
    </div>
  );
}

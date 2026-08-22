// Recommendations — both roles, same route, deliberately different pages.
//
// A GUIDE's page is a mixed list: their own picks, plus the company's list
// read-only, because a guide genuinely needs to see both to know what a
// guest ends up with.
//
// A COMPANY ADMIN's page is just their own recommendations. Founder's call:
// the company's list is simply "the company's recommendations" — not a
// "base list" sitting alongside guides' picks — and a company admin has no
// reason to browse what each guide has added. So the guide rows are dropped
// HERE, server-side, rather than fetched and then hidden in the client:
// there is no point shipping rows to a browser that must not display them.
//
// getRecommendationsForStudio still returns the whole tenant for a company
// actor (dashboards and the Report page legitimately aggregate across every
// guide), so the narrowing is this page's job, not the data layer's.

import { getRecommendationsForStudio } from "@/lib/data/source";
import RecommendationsManager from "@/components/studio/RecommendationsManager";
import { actorFromSession, requireDevSession } from "@/lib/studio/devAuth";

export default async function StudioRecommendationsPage() {
  const session = await requireDevSession();
  const actor = actorFromSession(session);

  const allRecommendations = await getRecommendationsForStudio(actor);

  const recommendations =
    session.role === "company"
      ? allRecommendations.filter((r) => r.ownerType === "company")
      : allRecommendations;

  return (
    <RecommendationsManager
      recommendations={recommendations}
      role={session.role}
      currentGuideId={session.role === "guide" ? session.guideId : undefined}
    />
  );
}

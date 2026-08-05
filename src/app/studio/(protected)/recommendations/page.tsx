// Recommendations — visible to both roles, same page. Data-access already
// scopes the read for us (getRecommendationsForStudio: a guide gets the
// base list + their own items, a company gets everything under its
// tenant), and saveRecommendation/deleteRecommendation already enforce who
// may write what — RecommendationsManager just needs to know which rows
// *this* actor is allowed to edit, which mirrors those same rules.

import { getGuidesForCompany, getRecommendationsForStudio } from "@/lib/data/source";
import RecommendationsManager from "@/components/studio/RecommendationsManager";
import { actorFromSession, requireDevSession } from "@/lib/studio/devAuth";

export default async function StudioRecommendationsPage() {
  const session = await requireDevSession();
  const actor = actorFromSession(session);

  const [recommendations, guides] = await Promise.all([
    getRecommendationsForStudio(actor),
    getGuidesForCompany(actor, session.companyId),
  ]);

  const guideNamesById = Object.fromEntries(guides.map((g) => [g.id, g.name]));

  return (
    <RecommendationsManager
      recommendations={recommendations}
      guideNamesById={guideNamesById}
      role={session.role}
      currentGuideId={session.role === "guide" ? session.guideId : undefined}
    />
  );
}

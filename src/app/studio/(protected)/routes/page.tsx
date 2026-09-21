import { getRoutesForStudio } from "@/lib/data/source";
import { actorFromSession, requireCompanyRole, requireDevSession } from "@/lib/studio/devAuth";
import RoutesManager from "@/components/studio/RoutesManager";

export const metadata = {
  title: "Routes — Map App Studio",
};

export default async function StudioRoutesPage() {
  const session = await requireDevSession();
  requireCompanyRole(session);
  const actor = actorFromSession(session);

  const routes = await getRoutesForStudio(actor, session.companyId);

  return <RoutesManager initialRoutes={routes} />;
}

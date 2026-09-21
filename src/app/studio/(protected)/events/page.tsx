import { getEventsForStudio } from "@/lib/data/source";
import { actorFromSession, requireCompanyRole, requireDevSession } from "@/lib/studio/devAuth";
import EventsManager from "@/components/studio/EventsManager";

export const metadata = {
  title: "Events — Map App Studio",
};

export default async function StudioEventsPage() {
  const session = await requireDevSession();
  requireCompanyRole(session);
  const actor = actorFromSession(session);

  const events = await getEventsForStudio(actor, session.companyId);

  return <EventsManager initialEvents={events} />;
}

// Boat tours — company only (PRD §7.5). Shows the admin-owned catalog plus
// this tenant's featured flag (getBoatCatalogForStudio already joins the
// two) and lets the company toggle which tours appear on its guide's map and
// reorder the featured set. No create/edit of the underlying tour itself —
// that's Admin-only (PRD §8.2).

import BoatToursManager from "@/components/studio/BoatToursManager";
import { PageHeader } from "@/components/studio/primitives";
import { getBoatCatalogForStudio } from "@/lib/data/source";
import { actorFromSession, requireCompanyRole, requireDevSession } from "@/lib/studio/devAuth";

export default async function StudioBoatToursPage() {
  const session = await requireDevSession();
  requireCompanyRole(session);
  const actor = actorFromSession(session);

  const catalog = await getBoatCatalogForStudio(actor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Boat tours"
        description="Choose which of Boat Local's tours appear on your guide's map, and in what order. Boats always show first on the guest map, ahead of every other category."
      />

      <BoatToursManager initialCatalog={catalog} />
    </div>
  );
}

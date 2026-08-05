import type { Metadata } from "next";

import { ADMIN_ACTOR } from "@/lib/admin/actor";
import { listBoatTourCatalog } from "@/lib/data/source";
import BoatToursManager from "@/components/admin/BoatToursManager";

export const metadata: Metadata = { title: "Boats" };

// Admin > Boats (PRD §8.2) — full CRUD for the platform boat tour catalog.
// This is the ONLY place a boat tour can be created or edited; Studio's own
// Boat tours tab (src/app/studio/boat-tours/page.tsx) only lets a company
// choose which of these to feature on its guest map, and in what order.
export default async function AdminBoatsPage() {
  const tours = await listBoatTourCatalog(ADMIN_ACTOR);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Boat tour catalog</h1>
      <p className="mt-1 text-sm text-[var(--admin-ink-soft)]">
        Create, edit, reorder and hide tours here. Changes propagate instantly to every
        company that features them.
      </p>

      <div className="mt-6">
        <BoatToursManager initialTours={tours} />
      </div>
    </div>
  );
}

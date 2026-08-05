"use server";

// Server Actions backing Studio > Boat tours (PRD §7.5, company-only). Every
// action re-checks the session itself (defence-in-depth layer #3 from the
// routing research notes — see devAuth.ts) rather than trusting whatever the
// client claims, exactly like a Server Component page would.
//
// These are thin wrappers around the already-permission-checked
// setBoatFeature/getBoatCatalogForStudio in src/lib/data/source.ts — no new
// data-access logic lives here, just the "what does a toggle/reorder click
// actually call" glue a Client Component needs.

import { revalidatePath } from "next/cache";

import { getBoatCatalogForStudio, setBoatFeature } from "@/lib/data/source";
import { actorFromSession, requireCompanyRole, requireDevSession } from "@/lib/studio/devAuth";

/**
 * Turns a boat tour's featured checkbox on/off. Newly-featured tours join at
 * the end of the tenant's current featured order (see getBoatTours' comment
 * in source.ts for why this order is tenant-specific, not the catalog's own
 * global position).
 */
export async function toggleBoatFeaturedAction(
  boatTourId: string,
  isFeatured: boolean,
): Promise<void> {
  const session = await requireDevSession();
  requireCompanyRole(session);
  const actor = actorFromSession(session);

  if (isFeatured) {
    const catalog = await getBoatCatalogForStudio(actor);
    const maxPosition = catalog
      .filter((t) => t.isFeatured)
      .reduce((max, t) => Math.max(max, t.featuredPosition), 0);
    await setBoatFeature(actor, boatTourId, true, maxPosition + 1);
  } else {
    await setBoatFeature(actor, boatTourId, false);
  }

  revalidatePath("/studio/boat-tours");
}

/**
 * Moves a featured tour up/down one slot within the tenant's featured order,
 * by swapping its `company_boat_features.position` with its neighbour's. A
 * no-op at either end of the list. Guide/other-tenant callers are rejected
 * by setBoatFeature itself (StudioPermissionError), same as any other write.
 */
export async function moveBoatFeaturedAction(
  boatTourId: string,
  direction: "up" | "down",
): Promise<void> {
  const session = await requireDevSession();
  requireCompanyRole(session);
  const actor = actorFromSession(session);

  const catalog = await getBoatCatalogForStudio(actor);
  const featured = catalog
    .filter((t) => t.isFeatured)
    .sort((a, b) => a.featuredPosition - b.featuredPosition);

  const index = featured.findIndex((t) => t.id === boatTourId);
  if (index === -1) return;

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= featured.length) return;

  const current = featured[index];
  const neighbour = featured[swapIndex];

  await setBoatFeature(actor, current.id, true, neighbour.featuredPosition);
  await setBoatFeature(actor, neighbour.id, true, current.featuredPosition);

  revalidatePath("/studio/boat-tours");
}

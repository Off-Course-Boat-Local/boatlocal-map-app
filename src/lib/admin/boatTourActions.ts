"use server";

// Server Actions for the Admin "Add / edit / delete / reorder boat tour"
// flow (PRD §8.2). This is the ONLY place a boat tour can be created,
// edited, deleted, or have its catalog-wide position changed — Studio's
// Boat tours tab only toggles/reorders which of these a company features
// (src/lib/studio/boatTourActions.ts's toggleBoatFeaturedAction /
// moveBoatFeaturedAction), never the tour record itself.
//
// Every action re-verifies the session itself via requireAdminSession()
// (src/lib/admin/devAuth.ts), the same "every Server Action re-checks,
// since it's effectively a public POST endpoint" rule Studio's actions
// follow.
//
// Permission enforcement is NOT duplicated here beyond that: saveBoatTour /
// deleteBoatTour / setBoatTourPosition in src/lib/data/source.ts already
// re-check the actor is admin and throw StudioPermissionError otherwise.
// This module's job is resolving the dev-auth session into the admin
// StudioActor and translating that error into the shape useActionState (or
// a plain client call) expects — field parsing/validation lives in the
// directive-free ./boatTourForm.ts, for the same "use server" files may
// only export async functions reason Studio's recommendationActions.ts
// documents.

import { revalidatePath } from "next/cache";

import {
  deleteBoatTour,
  listBoatTourCatalog,
  saveBoatTour,
  setBoatTourPosition,
} from "@/lib/data/source";
import { StudioPermissionError, type BoatTourStatus } from "@/lib/data/types";
import { requireAdminSession } from "./devAuth";
import { parseBoatTourForm } from "./boatTourForm";
import { ADMIN_ACTOR } from "./actor";

const BOATS_PATH = "/admin/boats";

export interface BoatTourFormState {
  error?: string;
  success?: boolean;
}

/** Passed to useActionState in BoatTourForm.tsx. */
export async function saveBoatTourAction(
  _prevState: BoatTourFormState,
  formData: FormData,
): Promise<BoatTourFormState> {
  await requireAdminSession();

  const parsed = parseBoatTourForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  try {
    await saveBoatTour(ADMIN_ACTOR, parsed.value);
  } catch (err) {
    if (err instanceof StudioPermissionError) return { error: err.message };
    throw err;
  }

  revalidatePath(BOATS_PATH);
  return { success: true };
}

/**
 * Called directly from BoatToursManager.tsx's onClick (Server Functions can
 * be invoked like any other async function from a Client Component, not
 * only wired to a <form>), not wired to a <form>.
 */
export async function deleteBoatTourAction(id: string): Promise<{ error?: string }> {
  await requireAdminSession();

  try {
    await deleteBoatTour(ADMIN_ACTOR, id);
  } catch (err) {
    if (err instanceof StudioPermissionError) return { error: err.message };
    throw err;
  }

  revalidatePath(BOATS_PATH);
  return {};
}

/**
 * Persists a full drag-and-drop (or keyboard arrow) reorder of the catalog:
 * `orderedIds` is the ENTIRE new id order (not just the id that moved), and
 * every id gets its `boat_tours.position` set to its 1-based index in that
 * list. This replaces the old moveBoatTourAction single-step swap — dropping
 * row 6 between rows 1 and 2 isn't a single swap, it's a renumbering of
 * every row from the drop point onward, so the caller (BoatToursManager)
 * always sends the full resulting order rather than "move this one row".
 *
 * Persistence strategy: sequential setBoatTourPosition calls, stopping at
 * the first failure. Considered and rejected:
 *   - Promise.all (parallel): faster, but failure containment gets murky —
 *     several positions can land before a later one rejects, in a
 *     non-deterministic completion order, which is harder to reason about
 *     than "everything before the failure point definitely landed, in
 *     order, nothing after it did."
 *   - A single bulk UPDATE: would need a raw SQL statement (e.g. a CASE
 *     expression or an UPDATE ... FROM VALUES) or an RPC function, neither
 *     of which exists yet for boat_tours and both of which are out of this
 *     change's scope (no source.ts edits). N is a boat catalog — small by
 *     construction — so N sequential calls, each of which already
 *     re-verifies admin, is an acceptable cost here.
 *
 * Partial-failure behaviour (e.g. call 3 of 6 rejects): the loop stops
 * immediately and returns that error. Positions 1..2 that already
 * succeeded are NOT rolled back — rolling back would itself be more calls
 * that could also fail, and mid-list, "admin lost their session" is the
 * realistic failure mode (setBoatTourPosition's only thrown error besides a
 * genuine DB error), not a per-row data problem, so a retry of the same
 * reorder is the right recovery, not an automatic undo. The client's
 * router.refresh() (fired unconditionally in BoatToursManager's runAction)
 * then shows exactly what's actually persisted — a partially-applied
 * reorder, not silently wrong data and not a crash.
 */
export async function reorderBoatToursAction(orderedIds: string[]): Promise<{ error?: string }> {
  await requireAdminSession();

  for (let index = 0; index < orderedIds.length; index += 1) {
    try {
      await setBoatTourPosition(ADMIN_ACTOR, orderedIds[index], index + 1);
    } catch (err) {
      if (err instanceof StudioPermissionError) return { error: err.message };
      throw err;
    }
  }

  revalidatePath(BOATS_PATH);
  return {};
}

/**
 * Quick "Activate"/"Deactivate" toggle from the row's kebab menu, so an
 * admin doesn't have to open the full edit form just to flip a tour's
 * status. saveBoatTour's update path can't patch status alone — its
 * SaveBoatTourInput requires name/area/lng/lat/meta/note/bookingUrl/photos
 * too (see its call in saveBoatTourAction above), so this reads the tour's
 * current record via listBoatTourCatalog first and resends it unchanged
 * alongside the flipped status, rather than adding a new narrower
 * source.ts function (out of this change's file scope).
 */
export async function toggleBoatTourStatusAction(id: string): Promise<{ error?: string }> {
  await requireAdminSession();

  const ordered = await listBoatTourCatalog(ADMIN_ACTOR);
  const tour = ordered.find((t) => t.id === id);
  if (!tour) return {};

  const nextStatus: BoatTourStatus = tour.status === "active" ? "hidden" : "active";

  try {
    await saveBoatTour(ADMIN_ACTOR, {
      id: tour.id,
      name: tour.name,
      area: tour.area,
      lng: tour.lng,
      lat: tour.lat,
      meta: tour.meta,
      note: tour.note,
      bookingUrl: tour.bookingUrl,
      photos: tour.photos,
      position: tour.position,
      status: nextStatus,
    });
  } catch (err) {
    if (err instanceof StudioPermissionError) return { error: err.message };
    throw err;
  }

  revalidatePath(BOATS_PATH);
  return {};
}

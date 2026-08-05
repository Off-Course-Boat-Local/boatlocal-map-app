"use server";

// Server Actions for the Admin "Add / edit / delete / reorder boat tour"
// flow (PRD §8.2). This is the ONLY place a boat tour can be created,
// edited, deleted, or have its catalog-wide position changed — Studio's
// Boat tours tab only toggles/reorders which of these a company features
// (src/lib/studio/boatTourActions.ts's toggleBoatFeaturedAction /
// moveBoatFeaturedAction), never the tour record itself.
//
// DEV AUTH STAND-IN — every action re-verifies the session itself via
// requireAdminSession() (src/lib/admin/devAuth.ts), the same "every Server
// Action re-checks, since it's effectively a public POST endpoint" rule
// Studio's actions follow.
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
import { StudioPermissionError } from "@/lib/data/types";
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
 * Moves a tour up/down one slot in the catalog's global position order, by
 * swapping its `boat_tours.position` with its immediate neighbour's. A
 * no-op at either end of the list. This is the "drag or numeric order"
 * requirement's quick-click half — the same position can also be set
 * directly from the numeric field in BoatTourForm.
 */
export async function moveBoatTourAction(
  id: string,
  direction: "up" | "down",
): Promise<{ error?: string }> {
  await requireAdminSession();

  const ordered = await listBoatTourCatalog(ADMIN_ACTOR);

  const index = ordered.findIndex((t) => t.id === id);
  if (index === -1) return {};

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= ordered.length) return {};

  const current = ordered[index];
  const neighbour = ordered[swapIndex];

  try {
    await setBoatTourPosition(ADMIN_ACTOR, current.id, neighbour.position);
    await setBoatTourPosition(ADMIN_ACTOR, neighbour.id, current.position);
  } catch (err) {
    if (err instanceof StudioPermissionError) return { error: err.message };
    throw err;
  }

  revalidatePath(BOATS_PATH);
  return {};
}

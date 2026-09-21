"use server";

import { revalidatePath } from "next/cache";
import { deleteCustomTour, saveCustomTour } from "@/lib/data/source";
import type { BoatTourRecord, SaveBoatTourInput } from "@/lib/data/types";
import { actorFromSession, getDevSession } from "./devAuth";

export async function saveCustomTourAction(
  input: SaveBoatTourInput,
): Promise<{ error?: string; tour?: BoatTourRecord }> {
  const session = await getDevSession();
  if (!session) {
    return { error: "Not signed in. Sign in again and retry." };
  }
  if (session.role !== "company") {
    return { error: "Only a company owner can create or edit custom tours." };
  }

  try {
    const actor = actorFromSession(session);
    const tour = await saveCustomTour(actor, { ...input, companyId: session.companyId });
    revalidatePath("/studio/boat-tours");
    revalidatePath("/studio");
    return { tour };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save tour." };
  }
}

export async function deleteCustomTourAction(
  id: string,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getDevSession();
  if (!session) {
    return { error: "Not signed in. Sign in again and retry." };
  }
  if (session.role !== "company") {
    return { error: "Only a company owner can delete custom tours." };
  }

  try {
    const actor = actorFromSession(session);
    await deleteCustomTour(actor, id);
    revalidatePath("/studio/boat-tours");
    revalidatePath("/studio");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete tour." };
  }
}

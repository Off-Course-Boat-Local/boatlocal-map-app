"use server";

import { revalidatePath } from "next/cache";
import { deleteRoute, saveRoute } from "@/lib/data/source";
import type { SaveRouteInput } from "@/lib/data/types";
import type { Route } from "@/lib/types";
import { actorFromSession, getDevSession } from "./devAuth";

export async function saveRouteAction(
  input: SaveRouteInput,
): Promise<{ error?: string; route?: Route }> {
  const session = await getDevSession();
  if (!session) {
    return { error: "Not signed in. Sign in again and retry." };
  }
  if (session.role !== "company") {
    return { error: "Only a company owner can create or edit routes." };
  }

  try {
    const actor = actorFromSession(session);
    const route = await saveRoute(actor, { ...input, companyId: session.companyId });
    revalidatePath("/studio/routes");
    revalidatePath("/studio");
    return { route };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save route." };
  }
}

export async function deleteRouteAction(
  id: string,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getDevSession();
  if (!session) {
    return { error: "Not signed in. Sign in again and retry." };
  }
  if (session.role !== "company") {
    return { error: "Only a company owner can delete routes." };
  }

  try {
    const actor = actorFromSession(session);
    await deleteRoute(actor, id);
    revalidatePath("/studio/routes");
    revalidatePath("/studio");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete route." };
  }
}

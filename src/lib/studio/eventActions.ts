"use server";

import { revalidatePath } from "next/cache";
import { deleteCompanyEvent, saveCompanyEvent } from "@/lib/data/source";
import type { SaveCompanyEventInput } from "@/lib/data/types";
import type { CompanyEvent } from "@/lib/types";
import { actorFromSession, getDevSession } from "./devAuth";

export async function saveCompanyEventAction(
  input: SaveCompanyEventInput,
): Promise<{ error?: string; event?: CompanyEvent }> {
  const session = await getDevSession();
  if (!session) {
    return { error: "Not signed in. Sign in again and retry." };
  }
  if (session.role !== "company") {
    return { error: "Only a company owner can create or edit events." };
  }

  try {
    const actor = actorFromSession(session);
    const event = await saveCompanyEvent(actor, { ...input, companyId: session.companyId });
    revalidatePath("/studio/events");
    revalidatePath("/studio");
    return { event };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save event." };
  }
}

export async function deleteCompanyEventAction(
  id: string,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getDevSession();
  if (!session) {
    return { error: "Not signed in. Sign in again and retry." };
  }
  if (session.role !== "company") {
    return { error: "Only a company owner can delete events." };
  }

  try {
    const actor = actorFromSession(session);
    await deleteCompanyEvent(actor, id);
    revalidatePath("/studio/events");
    revalidatePath("/studio");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete event." };
  }
}

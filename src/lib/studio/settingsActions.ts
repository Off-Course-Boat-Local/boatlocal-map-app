"use server";

import { revalidatePath } from "next/cache";
import { updateCompanyModules } from "@/lib/data/source";
import type { CompanyModules } from "@/lib/types";
import { actorFromSession, getDevSession } from "./devAuth";

export async function updateCompanyModulesAction(
  companyId: string,
  modules: CompanyModules,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getDevSession();
  if (!session) {
    return { error: "Not signed in. Sign in again and retry." };
  }
  if (session.role !== "company") {
    return { error: "Only a company owner can update company modules." };
  }
  if (session.companyId !== companyId) {
    return { error: "Cannot modify modules for another company." };
  }

  try {
    const actor = actorFromSession(session);
    await updateCompanyModules(actor, companyId, modules);
    revalidatePath("/studio");
    revalidatePath("/studio/settings");
    revalidatePath("/studio/routes");
    revalidatePath("/studio/events");
    revalidatePath("/studio/boat-tours");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update module settings." };
  }
}

"use server";

import { revalidatePath } from "next/cache";

import {
  cloneCompanyHubToGuide,
  resetGuideHubToCompany,
  saveWelcomeHubBlocks,
} from "@/lib/data/welcomeHub";
import { getGuidesForCompany } from "@/lib/data/source";
import { validateWelcomeBlocks, WelcomeBlockValidationError } from "@/lib/welcome-blocks/validate";
import { actorFromSession, getDevSession } from "./devAuth";

export interface WelcomeHubActionResult {
  error?: string;
  ok?: boolean;
}

/**
 * Resolves the signed-in company owner and (optionally) confirms the target
 * guide belongs to their company, so a guessed guideId can't touch another
 * tenant's hub. Guides themselves cannot edit hubs here.
 */
async function authorise(guideId: string | null) {
  const session = await getDevSession();
  if (!session) return { error: "Not signed in. Sign in again and retry." } as const;
  if (session.role !== "company") {
    return { error: "Only a company owner can edit welcome hubs." } as const;
  }
  const actor = actorFromSession(session);
  if (guideId) {
    const guides = await getGuidesForCompany(actor, session.companyId);
    if (!guides.some((g) => g.id === guideId)) return { error: "Unknown guide." } as const;
  }
  return { session, actor } as const;
}

function revalidate() {
  revalidatePath("/studio/welcome-hub");
  revalidatePath("/");
}

export async function saveWelcomeHubAction(
  guideId: string | null,
  blocks: unknown,
): Promise<WelcomeHubActionResult> {
  const auth = await authorise(guideId);
  if ("error" in auth) return { error: auth.error };
  try {
    const valid = validateWelcomeBlocks(blocks);
    await saveWelcomeHubBlocks(auth.actor, auth.session.companyId, guideId, valid);
    revalidate();
    return { ok: true };
  } catch (err) {
    if (err instanceof WelcomeBlockValidationError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Failed to save welcome hub." };
  }
}

export async function cloneCompanyHubToGuideAction(guideId: string): Promise<WelcomeHubActionResult> {
  const auth = await authorise(guideId);
  if ("error" in auth) return { error: auth.error };
  try {
    await cloneCompanyHubToGuide(auth.actor, auth.session.companyId, guideId);
    revalidate();
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to copy the company template." };
  }
}

export async function resetGuideHubAction(guideId: string): Promise<WelcomeHubActionResult> {
  const auth = await authorise(guideId);
  if ("error" in auth) return { error: auth.error };
  try {
    await resetGuideHubToCompany(auth.actor, auth.session.companyId, guideId);
    revalidate();
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reset the guide hub." };
  }
}

"use server";

// Server Action backing Studio > Campaign (PRD §7.6, company-only). Persists
// through the same updateCompanyBranding the Branding tab will eventually
// use, so campaignParams lives in exactly one place (CompanyRecord), not a
// parallel localStorage-only store — see CampaignForm.tsx for why
// localStorage still shows up there (an unsaved-draft cache, not the source
// of truth).

import { revalidatePath } from "next/cache";

import { updateCompanyBranding } from "@/lib/data/source";
import { normalizeCampaignParams } from "@/lib/studio/campaignParams";
import { actorFromSession, requireCompanyRole, requireDevSession } from "@/lib/studio/devAuth";

export interface SaveCampaignActionState {
  error?: string;
  /** Set on success so the client can resync its input with the normalized value actually persisted. */
  savedValue?: string;
}

export async function saveCampaignParamsAction(
  _prevState: SaveCampaignActionState,
  formData: FormData,
): Promise<SaveCampaignActionState> {
  const session = await requireDevSession();
  requireCompanyRole(session);
  const actor = actorFromSession(session);

  const raw = String(formData.get("campaignParams") ?? "");
  const normalized = normalizeCampaignParams(raw);

  await updateCompanyBranding(actor, session.companyId, {
    campaignParams: normalized || null,
  });

  revalidatePath("/studio/campaign");
  return { savedValue: normalized };
}

"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ACTOR } from "@/lib/admin/actor";
import { deactivateGuide, reactivateGuide } from "@/lib/data/source";

export async function setAdminGuideActiveAction(
  guideId: string,
  nextActive: boolean,
): Promise<void> {
  if (nextActive) {
    await reactivateGuide(ADMIN_ACTOR, guideId);
  } else {
    await deactivateGuide(ADMIN_ACTOR, guideId);
  }
  revalidatePath("/admin/guides");
}

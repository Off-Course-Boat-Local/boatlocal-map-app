"use server";

// Studio Guides — write-side Server Actions: invite, deactivate/reactivate
// (company-only, PRD §7.3), and a guide editing their own profile (PRD
// §6.2). Kept separate from src/lib/studio/actions.ts (login/logout) since
// these are ordinary authenticated Studio actions, not part of the DEV AUTH
// STAND-IN itself — though each one still re-checks the caller's session and
// role before doing anything, which is layer #3 of the defence-in-depth
// described in devAuth.ts's header comment. src/lib/data/source.ts's
// inviteGuide/setGuideStatus/updateGuideProfile enforce the same checks
// again, mirroring what RLS will do once it's real — this file's checks are
// the redundant-on-purpose outer layer, not the only one.

import { revalidatePath } from "next/cache";

import { deactivateGuide, inviteGuide, reactivateGuide, updateGuideProfile } from "@/lib/data/source";
import { StudioPermissionError } from "@/lib/data/types";
import { GUIDE_WELCOME_MAX_LENGTH } from "./guideProfile";
import { actorFromSession, requireCompanyRole, requireDevSession, requireGuideRole } from "./devAuth";

export interface InviteGuideActionState {
  error?: string;
  success?: boolean;
}

export async function inviteGuideAction(
  _prevState: InviteGuideActionState,
  formData: FormData,
): Promise<InviteGuideActionState> {
  const session = await requireDevSession();
  requireCompanyRole(session);
  const actor = actorFromSession(session);

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!name) return { error: "Enter the guide's name." };
  if (!email) return { error: "Enter the guide's email." };

  try {
    await inviteGuide(actor, session.companyId, { name, email });
  } catch (err) {
    return {
      error: err instanceof StudioPermissionError ? err.message : "Could not invite this guide.",
    };
  }

  revalidatePath("/studio/guides");
  return { success: true };
}

/**
 * Bound as `setGuideActiveAction.bind(null, guide.id, nextActive)` in a
 * per-row `<form action={...}>` (see GuidesTable.tsx) — the Next.js pattern
 * for passing extra arguments to a Server Action beyond the FormData every
 * `<form action>` submission supplies. Works with JS disabled, unlike a
 * client-side onClick handler would.
 */
export async function setGuideActiveAction(
  guideId: string,
  nextActive: boolean,
  // Required by the bound-Server-Action signature (the <form> submission
  // supplies it as the last argument) but unused — the row/status to change
  // already came in via .bind() above.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<void> {
  const session = await requireDevSession();
  requireCompanyRole(session);
  const actor = actorFromSession(session);

  if (nextActive) {
    await reactivateGuide(actor, guideId);
  } else {
    await deactivateGuide(actor, guideId);
  }
  revalidatePath("/studio/guides");
}

export interface UpdateGuideProfileActionState {
  error?: string;
  success?: boolean;
}

export async function updateGuideProfileAction(
  _prevState: UpdateGuideProfileActionState,
  formData: FormData,
): Promise<UpdateGuideProfileActionState> {
  const session = await requireDevSession();
  requireGuideRole(session);
  const actor = actorFromSession(session);

  const welcomeMessage = String(formData.get("welcomeMessage") ?? "").slice(
    0,
    GUIDE_WELCOME_MAX_LENGTH,
  );

  let avatarUrl: string | undefined;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/")) {
      return { error: "Please choose an image file." };
    }
    // No file storage exists yet (no real Supabase Storage bucket) — a data
    // URL keeps the fake store self-contained for this dev stand-in.
    // TODO: replace with an upload to Supabase Storage once the project
    // exists, storing the resulting public URL instead of the data URL.
    const buffer = Buffer.from(await photo.arrayBuffer());
    avatarUrl = `data:${photo.type};base64,${buffer.toString("base64")}`;
  }

  try {
    await updateGuideProfile(actor, session.guideId, {
      welcomeMessage,
      ...(avatarUrl ? { avatarUrl } : {}),
    });
  } catch (err) {
    return {
      error: err instanceof StudioPermissionError ? err.message : "Could not update your profile.",
    };
  }

  revalidatePath("/studio/profile");
  return { success: true };
}

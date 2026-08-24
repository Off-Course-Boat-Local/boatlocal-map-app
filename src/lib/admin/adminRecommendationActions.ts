"use server";

// Server Actions for Admin's "Admin recommendations for {company}" section
// (the company detail page, src/app/admin/(protected)/companies/[id]/page.tsx)
// — add/edit/delete/toggle-visible for one company's owner_type='admin'
// recommendations. This is the ONLY place these rows can be written from —
// they are deliberately absent from Studio entirely (see
// src/lib/data/types.ts's RecommendationOwnerType doc comment and
// supabase/migrations/20260824090100_admin_recommendations_rls.sql for the
// security model).
//
// Every action re-verifies the session itself via requireAdminSession(),
// same "every Server Action re-checks, since it's effectively a public POST
// endpoint" rule every other src/lib/admin/*Actions.ts file follows.
//
// Permission enforcement is NOT duplicated here beyond that:
// saveRecommendation/deleteRecommendation/setRecommendationVisibility in
// src/lib/data/source.ts already re-check the actor and throw
// StudioPermissionError otherwise (and, on the real backend, RLS enforces
// the same rules again underneath that). This module's job is resolving
// the admin session, binding the target company's id, and translating a
// thrown StudioPermissionError into the shape useActionState (or a plain
// client call) expects — same split as src/lib/admin/boatTourActions.ts and
// src/lib/admin/defaultCompanyActions.ts.

import { revalidatePath } from "next/cache";

import {
  deleteRecommendation,
  saveRecommendation,
  setRecommendationVisibility,
} from "@/lib/data/source";
import { StudioPermissionError } from "@/lib/data/types";
import { requireAdminSession } from "./devAuth";
import { parseAdminRecommendationForm } from "./adminRecommendationForm";
import { ADMIN_ACTOR } from "./actor";

export interface AdminRecommendationFormState {
  error?: string;
  success?: boolean;
}

function companyPath(companyId: string): string {
  return `/admin/companies/${companyId}`;
}

/**
 * Passed to useActionState in AdminRecommendationForm.tsx, bound with the
 * target company's id via `.bind(null, companyId)` — useActionState leaves
 * no room for a third argument, same reason
 * saveDefaultCompanyRecommendationAction is always bound this way in
 * src/lib/admin/defaultCompanyActions.ts. `companyId` therefore always comes
 * from the server-rendered page context, never from a client-submitted form
 * field — the one thing that actually scopes an admin-curated recommendation
 * to the right tenant.
 */
export async function saveAdminRecommendationAction(
  companyId: string,
  _prevState: AdminRecommendationFormState,
  formData: FormData,
): Promise<AdminRecommendationFormState> {
  await requireAdminSession();

  const parsed = parseAdminRecommendationForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  try {
    await saveRecommendation(ADMIN_ACTOR, { ...parsed.value, companyId });
  } catch (err) {
    if (err instanceof StudioPermissionError) return { error: err.message };
    throw err;
  }

  revalidatePath(companyPath(companyId));
  return { success: true };
}

/**
 * Called directly from AdminRecommendationsManager.tsx's onClick (Server
 * Functions can be invoked like any other async function from a Client
 * Component, not only wired to a <form>) — same calling convention as
 * BoatToursManager.tsx's deleteBoatTourAction.
 */
export async function deleteAdminRecommendationAction(
  companyId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireAdminSession();

  try {
    await deleteRecommendation(ADMIN_ACTOR, id);
  } catch (err) {
    if (err instanceof StudioPermissionError) return { error: err.message };
    throw err;
  }

  revalidatePath(companyPath(companyId));
  return {};
}

/** Quick on/off toggle from the row's Live switch, mirroring Studio's own quick-visibility toggle. */
export async function setAdminRecommendationVisibilityAction(
  companyId: string,
  id: string,
  visible: boolean,
): Promise<{ error?: string; visible?: boolean }> {
  await requireAdminSession();

  try {
    await setRecommendationVisibility(ADMIN_ACTOR, id, visible);
  } catch (err) {
    if (err instanceof StudioPermissionError) return { error: err.message };
    throw err;
  }

  revalidatePath(companyPath(companyId));
  return { visible };
}

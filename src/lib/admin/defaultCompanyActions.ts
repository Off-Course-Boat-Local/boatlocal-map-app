"use server";

// Admin's platform-default-company Server Actions — the write side of
// /admin/default-company (src/app/admin/(protected)/default-company/page.tsx)
// and CompanyRowActions.tsx's "Set as default"/"Unset as default" kebab
// items.
//
// This deliberately does NOT introduce a second content-management system:
// every write below is the exact same src/lib/data/source.ts call Studio's
// own Branding/Recommendations pages already make
// (updateCompanyBranding/saveRecommendation/deleteRecommendation/
// setRecommendationVisibility) — this file's only job is Admin's own
// session check + actor plumbing, mirroring src/lib/studio/brandingActions.ts
// and src/lib/studio/recommendationActions.ts one-for-one, the same way
// src/lib/admin/companyActions.ts already mirrors those for onboarding/
// status changes.
//
// ADMIN ACTING "AS THE COMPANY" FOR RECOMMENDATIONS: saveRecommendation()
// deliberately refuses a literal `{ role: "admin" }` actor ("admin does not
// own tenant content... act as the company or guide instead" — see its own
// comment in source.ts) — a real business rule, not just an RLS mirror.
// saveDefaultCompanyRecommendationAction below follows that instruction
// literally: it passes `{ role: "company", companyId }` for the flagged
// platform-default company, exactly what a real company owner's own actor
// would look like. This is safe precisely because of what that same comment
// says next: on the real backend, authedClient() runs every query as
// whichever Supabase Auth session is ACTUALLY signed in for this request —
// Admin's own — and RLS's `admin_full_access` (not `company_manage_base_list`)
// is what actually authorises the write, regardless of which StudioActor
// shape this file's TypeScript happens to construct. The actor object here
// only picks which in-code branch of saveRecommendation() runs (so the
// resulting row gets `owner_type = 'company'`, exactly like any other
// company's base list); it grants no privilege of its own.
//
// deleteRecommendation/setRecommendationVisibility/updateCompanyBranding all
// already accept a literal admin actor (see their own comments in
// source.ts), so those three use ADMIN_ACTOR directly, same as every other
// file in src/lib/admin/.

import { revalidatePath } from "next/cache";

import {
  deleteRecommendation,
  saveRecommendation,
  setPlatformDefaultCompany,
  setRecommendationVisibility,
  unsetPlatformDefaultCompany,
  updateCompanyBranding,
  type UpdateCompanyBrandingInput,
} from "@/lib/data/source";
import { StudioPermissionError, type CompanyRecord } from "@/lib/data/types";
import type { RecommendationFormState } from "@/lib/studio/recommendationActions";
import { parseRecommendationForm } from "@/lib/studio/recommendationForm";

import { ADMIN_ACTOR } from "./actor";
import { requireAdminSession } from "./devAuth";

const DEFAULT_COMPANY_PATH = "/admin/default-company";
const COMPANIES_PATH = "/admin/companies";

export interface PlatformDefaultActionState {
  error?: string;
}

/**
 * Flags an existing company as the platform default, clearing whichever
 * company held it before (setPlatformDefaultCompany's own job) — the
 * first-run picker on /admin/default-company and CompanyRowActions.tsx's
 * "Set as default" menu item both call this directly (not bound to a
 * <form>), same calling convention as CompanyRowActions' own
 * deleteCompanyAction.
 */
export async function setPlatformDefaultCompanyAction(
  companyId: string,
): Promise<PlatformDefaultActionState> {
  await requireAdminSession();
  try {
    await setPlatformDefaultCompany(ADMIN_ACTOR, companyId);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not set this company as the platform default.",
    };
  }
  revalidatePath(DEFAULT_COMPANY_PATH);
  revalidatePath(COMPANIES_PATH);
  return {};
}

/** CompanyRowActions.tsx's "Unset as default" menu item, and the default-company page's own "stop being the default" control. */
export async function unsetPlatformDefaultCompanyAction(): Promise<PlatformDefaultActionState> {
  await requireAdminSession();
  try {
    await unsetPlatformDefaultCompany(ADMIN_ACTOR);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not unset the platform default company.",
    };
  }
  revalidatePath(DEFAULT_COMPANY_PATH);
  revalidatePath(COMPANIES_PATH);
  return {};
}

/** Passed as BrandingForm's `saveAction` prop on /admin/default-company — see that component's own doc comment. */
export async function saveDefaultCompanyBrandingAction(
  companyId: string,
  input: UpdateCompanyBrandingInput,
): Promise<CompanyRecord> {
  await requireAdminSession();
  const updated = await updateCompanyBranding(ADMIN_ACTOR, companyId, input);
  revalidatePath(DEFAULT_COMPANY_PATH);
  return updated;
}

/**
 * Passed as RecommendationsManager/RecommendationForm's `saveAction` prop,
 * bound with the flagged company's id — `useActionState` leaves no room for
 * a third argument, the same reason src/lib/admin/companyActions.ts's
 * setCompanyStatusAction is always used via `.bind(null, companyId, ...)`.
 * See this file's header comment for why the actor is `{ role: "company" }`
 * rather than ADMIN_ACTOR.
 */
export async function saveDefaultCompanyRecommendationAction(
  companyId: string,
  _prevState: RecommendationFormState,
  formData: FormData,
): Promise<RecommendationFormState> {
  await requireAdminSession();

  const parsed = parseRecommendationForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  try {
    await saveRecommendation({ role: "company", companyId }, parsed.value);
  } catch (err) {
    if (err instanceof StudioPermissionError) return { error: err.message };
    throw err;
  }

  revalidatePath(DEFAULT_COMPANY_PATH);
  return { success: true };
}

/** Passed as RecommendationsManager's `deleteAction` prop on /admin/default-company. */
export async function deleteDefaultCompanyRecommendationAction(
  id: string,
): Promise<{ error?: string }> {
  await requireAdminSession();
  try {
    await deleteRecommendation(ADMIN_ACTOR, id);
  } catch (err) {
    if (err instanceof StudioPermissionError) return { error: err.message };
    throw err;
  }
  revalidatePath(DEFAULT_COMPANY_PATH);
  return {};
}

/** Passed as RecommendationsManager's `setVisibilityAction` prop on /admin/default-company. */
export async function setDefaultCompanyRecommendationVisibilityAction(
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
  revalidatePath(DEFAULT_COMPANY_PATH);
  return { visible };
}

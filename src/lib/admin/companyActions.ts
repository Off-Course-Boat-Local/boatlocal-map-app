"use server";

// Admin Companies — write-side Server Actions: onboard a new company (PRD
// §8.3) and flip an existing company's status (setup -> live, or
// suspend/reactivate). Kept separate from src/app/admin/(protected)/actions.ts
// (logout) and src/lib/admin/devAuth.ts (session/auth handling) for the
// same reason src/lib/studio/guideActions.ts is split out from
// src/lib/studio/devAuth.ts — these are ordinary authenticated Admin
// actions, not auth plumbing itself. Each one still re-checks the
// caller's session itself (requireAdminSession), which is layer #3 of the
// defence-in-depth described in devAuth.ts's header comment;
// src/lib/data/source.ts's createCompany/setCompanyStatus enforce the
// actor's role again on top of that, mirroring what RLS will do once it's
// real.

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/admin/devAuth";
import { createCompany, setCompanyStatus } from "@/lib/data/source";
import type { CompanyStatus, CompanyType } from "@/lib/data/types";

import { ADMIN_ACTOR } from "./actor";

const COMPANY_TYPES: CompanyType[] = ["hotel", "tour", "host"];
const COMPANY_STATUSES: CompanyStatus[] = ["setup", "active", "suspended"];

export interface CreateCompanyActionState {
  error?: string;
  success?: boolean;
}

export async function createCompanyAction(
  _prevState: CreateCompanyActionState,
  formData: FormData,
): Promise<CreateCompanyActionState> {
  await requireAdminSession();

  const name = String(formData.get("name") ?? "").trim();
  const subdomain = String(formData.get("subdomain") ?? "").trim();
  const companyTypeRaw = String(formData.get("companyType") ?? "");
  const statusRaw = String(formData.get("status") ?? "setup");

  if (!name) return { error: "Company name is required." };
  if (!COMPANY_TYPES.includes(companyTypeRaw as CompanyType)) {
    return { error: "Choose a company type." };
  }
  if (!COMPANY_STATUSES.includes(statusRaw as CompanyStatus)) {
    return { error: "Choose a valid initial status." };
  }

  try {
    await createCompany(ADMIN_ACTOR, {
      name,
      subdomain: subdomain || undefined,
      companyType: companyTypeRaw as CompanyType,
      status: statusRaw as CompanyStatus,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create this company." };
  }

  // /admin/companies has the full list this form lives on; /admin's
  // Overview also reads listCompanies() for its "Companies" stat card
  // (count + active hint), so revalidate both rather than leaving the
  // Overview count stale until its own next full reload.
  revalidatePath("/admin/companies");
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Bound as `setCompanyStatusAction.bind(null, company.id, nextStatus)` in a
 * per-row `<form action={...}>` — same pattern as
 * src/lib/studio/guideActions.ts's setGuideActiveAction, for the same
 * reason (works with JS disabled, unlike a client-side onClick handler).
 */
export async function setCompanyStatusAction(
  companyId: string,
  nextStatus: CompanyStatus,
  // Required by the bound-Server-Action signature (the <form> submission
  // supplies it as the last argument) but unused — the row/status to change
  // already came in via .bind() above.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<void> {
  await requireAdminSession();
  await setCompanyStatus(ADMIN_ACTOR, companyId, nextStatus);
  revalidatePath("/admin/companies");
}

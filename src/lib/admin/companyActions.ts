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
import { createCompany, deleteCompany, setCompanyStatus } from "@/lib/data/source";
import type { CompanyStatus, CompanyType } from "@/lib/data/types";

import { ADMIN_ACTOR } from "./actor";
import { regenerateOwnerInvite, sendOwnerInvite } from "./ownerInvite";

const COMPANY_TYPES: CompanyType[] = ["hotel", "tour", "host"];
const COMPANY_STATUSES: CompanyStatus[] = ["setup", "active", "suspended"];

export interface CreateCompanyActionState {
  error?: string;
  success?: boolean;
  /**
   * Set when the company WAS created but its invite email did not go out.
   * Deliberately distinct from `error`: the company exists and retrying the
   * form would fail on subdomain uniqueness, so this must never read as
   * "creation failed". The operator's recovery is the copy-able invite link
   * on the row, or Resend once email is configured.
   */
  inviteWarning?: string;
}

export async function createCompanyAction(
  _prevState: CreateCompanyActionState,
  formData: FormData,
): Promise<CreateCompanyActionState> {
  await requireAdminSession();

  const name = String(formData.get("name") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim();
  const subdomain = String(formData.get("subdomain") ?? "").trim();
  const companyTypeRaw = String(formData.get("companyType") ?? "");
  const statusRaw = String(formData.get("status") ?? "setup");

  if (!name) return { error: "Company name is required." };
  if (!ownerEmail) return { error: "Owner's email is required." };
  if (!COMPANY_TYPES.includes(companyTypeRaw as CompanyType)) {
    return { error: "Choose a company type." };
  }
  if (!COMPANY_STATUSES.includes(statusRaw as CompanyStatus)) {
    return { error: "Choose a valid initial status." };
  }

  let companyId: string;
  try {
    const created = await createCompany(ADMIN_ACTOR, {
      name,
      ownerEmail,
      subdomain: subdomain || undefined,
      companyType: companyTypeRaw as CompanyType,
      status: statusRaw as CompanyStatus,
    });
    companyId = created.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create this company." };
  }

  // The company row and its invite token are now committed. Sending is a
  // separate, best-effort step: a provider outage or unverified sending
  // domain must not present as "creating the company failed", because the
  // company DOES exist and re-submitting would only collide on subdomain
  // uniqueness. A failure here downgrades to a warning plus the copy-able
  // link on the row.
  const send = await sendOwnerInvite(companyId);
  const inviteWarning =
    send.status === "failed"
      ? `Company created, but the invite email to ${send.to} could not be sent (${send.error}). Copy the invite link from the row below and send it manually.`
      : undefined;

  // /admin/companies has the full list this form lives on; /admin's
  // Overview also reads listCompanies() for its "Companies" stat card
  // (count + active hint), so revalidate both rather than leaving the
  // Overview count stale until its own next full reload.
  revalidatePath("/admin/companies");
  revalidatePath("/admin");
  return { success: true, inviteWarning };
}

export interface InviteActionState {
  message?: string;
  error?: string;
}

/**
 * Re-sends the EXISTING invite token. Use when the owner says the email
 * never arrived but the address is right — any earlier copy of the link
 * keeps working.
 */
export async function resendOwnerInviteAction(
  companyId: string,
  // Both required by the useActionState signature but unused — the company
  // to act on came in via .bind() above. Same pattern as
  // setCompanyStatusAction below.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: InviteActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<InviteActionState> {
  await requireAdminSession();
  const result = await sendOwnerInvite(companyId);
  revalidatePath("/admin/companies");

  if (result.status === "sent") return { message: `Invite re-sent to ${result.to}.` };
  if (result.status === "failed") return { error: result.error };
  return { error: "This company has no pending owner invite." };
}

/**
 * Issues a NEW token and emails it, invalidating the previous link. Use
 * when the old invite may have gone astray — a wrong address, a forwarded
 * email — rather than merely undelivered.
 */
export async function regenerateOwnerInviteAction(
  companyId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: InviteActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<InviteActionState> {
  await requireAdminSession();
  const result = await regenerateOwnerInvite(companyId);
  revalidatePath("/admin/companies");

  if (result.status === "sent") return { message: `New invite sent to ${result.to}.` };
  if (result.status === "failed") return { error: result.error };
  return { error: "This company has no pending owner invite to replace." };
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
  revalidatePath(`/admin/companies/${companyId}`);
}

export interface DeleteCompanyActionState {
  error?: string;
}

/**
 * Called directly from CompanyRowActions.tsx's confirmation dialog (not
 * bound to a <form>) — a plain async Server Action reference is callable
 * from client code the same way, and this needs to report success/failure
 * back into that dialog's own state rather than a page navigation.
 */
export async function deleteCompanyAction(companyId: string): Promise<DeleteCompanyActionState> {
  await requireAdminSession();
  try {
    await deleteCompany(ADMIN_ACTOR, companyId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not delete this company." };
  }
  revalidatePath("/admin/companies");
  revalidatePath("/admin");
  return {};
}

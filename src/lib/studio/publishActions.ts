"use server";

// The Dashboard's "Publish / Unpublish" toggle — a company's own
// self-service control over whether it's guest-visible (PRD §2.3 "setup vs
// live"), now that Admin no longer picks an initial status at onboarding
// time (see docs/handover context: companies always start "setup").
//
// Same plumbing shape as saveCompanyBrandingAction beside it: re-reads and
// re-validates the session itself rather than trusting a client-supplied
// companyId, and throws a plain catchable Error for the client component's
// own try/catch instead of redirect()ing mid-mutation.
//
// setCompanyStatus() itself (src/lib/data/source.ts) is what actually
// enforces a company can only move between 'setup' and 'active' — never
// 'suspended' in either direction — this file doesn't duplicate that rule,
// only session/permission plumbing.

import { revalidatePath } from "next/cache";

import { setCompanyStatus } from "@/lib/data/source";
import type { CompanyRecord, CompanyStatus } from "@/lib/data/types";

import { actorFromSession, getDevSession } from "./devAuth";

export async function setCompanyPublishedAction(
  companyId: string,
  published: boolean,
): Promise<CompanyRecord> {
  const session = await getDevSession();
  if (!session) {
    throw new Error("Not signed in. Sign in again and retry.");
  }
  if (session.role !== "company") {
    throw new Error("Only a company account can publish or unpublish itself.");
  }
  if (session.companyId !== companyId) {
    throw new Error("Cannot change another company's publish status.");
  }

  const actor = actorFromSession(session);
  const nextStatus: CompanyStatus = published ? "active" : "setup";
  const updated = await setCompanyStatus(actor, companyId, nextStatus);

  revalidatePath("/studio");
  return updated;
}

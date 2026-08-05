"use server";

// The Branding form's real save path.
//
// This is deliberately NOT another DEV AUTH STAND-IN file: it does not
// invent any auth of its own. It reads the existing dev session
// (getDevSession(), src/lib/studio/devAuth.ts) and re-validates role +
// company scope itself before calling updateCompanyBranding()
// (src/lib/data/source.ts) — the same "every layer re-checks" posture the
// rest of Studio's data access already follows, and it's what lets this
// throw a plain catchable Error for BrandingForm's try/catch instead of
// redirect()ing mid-mutation (requireDevSession()/requireCompanyRole()
// redirect, which is right for page loads but wrong for a client-invoked
// action that expects a normal resolve/reject).
//
// updateCompanyBranding() itself is already commented as the TODO for the
// real Supabase call:
//   supabase.from('companies').update({ ... }).eq('id', companyId)
// so there is nothing further to fake here — this file's only job is
// session/permission plumbing between the client form and that function.

import { revalidatePath } from "next/cache";

import { updateCompanyBranding, type UpdateCompanyBrandingInput } from "@/lib/data/source";
import type { CompanyRecord } from "@/lib/data/types";
import { actorFromSession, getDevSession } from "./devAuth";

export async function saveCompanyBrandingAction(
  companyId: string,
  input: UpdateCompanyBrandingInput,
): Promise<CompanyRecord> {
  const session = await getDevSession();
  if (!session) {
    throw new Error("Not signed in. Sign in again and retry.");
  }
  if (session.role !== "company") {
    throw new Error("Only a company account can edit branding.");
  }
  if (session.companyId !== companyId) {
    throw new Error("Cannot edit another company's branding.");
  }

  const actor = actorFromSession(session);
  const updated = await updateCompanyBranding(actor, companyId, input);

  // Re-render the Branding page and the Studio layout (which re-fetches the
  // company brand for PhonePreviewPanel) with the freshly saved values.
  revalidatePath("/studio/branding");
  revalidatePath("/studio");

  return updated;
}

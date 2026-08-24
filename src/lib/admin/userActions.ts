"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/admin/devAuth";
import {
  createPlatformInvite,
  platformEmailExists,
  type PlatformUserRole,
} from "@/lib/admin/users";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = new Set<PlatformUserRole>(["admin", "company", "guide"]);

export interface EmailAvailabilityState {
  available: boolean;
  error?: string;
}

export interface InviteUserActionState {
  error?: string;
  success?: boolean;
  email?: string;
  emailSent?: boolean;
  inviteUrl?: string;
  emailError?: string;
}

export async function checkUserEmailAction(rawEmail: string): Promise<EmailAvailabilityState> {
  await requireAdminSession();
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { available: false, error: "Enter a valid email address." };

  try {
    const exists = await platformEmailExists(email);
    return exists
      ? { available: false, error: "A user or pending invitation already exists for this email." }
      : { available: true };
  } catch {
    return { available: false, error: "Could not check this email right now." };
  }
}

export async function inviteUserAction(
  _prevState: InviteUserActionState,
  formData: FormData,
): Promise<InviteUserActionState> {
  const session = await requireAdminSession();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const role = String(formData.get("role") ?? "") as PlatformUserRole;
  const companyId = String(formData.get("companyId") ?? "").trim() || null;

  if (!EMAIL_PATTERN.test(email)) return { error: "Enter a valid email address." };
  if (firstName.length > 80 || lastName.length > 80) {
    return { error: "First and last names must each be 80 characters or fewer." };
  }
  if (!VALID_ROLES.has(role)) return { error: "Choose a valid user role." };
  if (role !== "admin" && !companyId) return { error: "Choose a company for this role." };

  try {
    const result = await createPlatformInvite({
      email,
      firstName,
      lastName,
      role,
      companyId: role === "admin" ? null : companyId,
      invitedBy: session.id,
    });

    if (result.status === "exists") {
      return { error: "A user or pending invitation already exists for this email." };
    }
    if (result.status === "error") return { error: result.error };

    revalidatePath("/admin/users");
    return {
      success: true,
      email,
      emailSent: result.emailSent,
      inviteUrl: result.inviteUrl,
      emailError: result.emailError,
    };
  } catch {
    return { error: "Could not create this invitation. Please try again." };
  }
}

"use server";

import { redirect } from "next/navigation";
import { isEmailAllowlistedForAdmin } from "@/lib/admin/allowlist";
import { getAdminLoginProfileState } from "@/lib/admin/passwordStatus";
import { createClient } from "@/lib/supabase/server";
import { sendPasswordSetupEmailAction } from "@/lib/auth/passwordActions";

export interface AdminLoginState {
  error?: string;
  sent?: boolean;
  passwordMode?: boolean;
  email?: string;
}

function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Step 1: email only.
 * - Validates format.
 * - If not an authorized staff account, returns clear error feedback.
 * - If authorized and has a password -> passwordMode: true.
 * - If authorized without a password -> sends branded password setup link.
 */
export async function checkAdminLoginMethodAction(
  _prevState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!isPlausibleEmail(email)) {
    return { error: "Enter a valid email address." };
  }

  const allowlisted = isEmailAllowlistedForAdmin(email);
  const adminProfile = await getAdminLoginProfileState(email);
  const authorized = allowlisted || adminProfile.exists;

  if (!authorized) {
    return {
      error: "No staff account found with this email address. Please check for typos or ask an administrator for an invitation.",
    };
  }

  if (adminProfile.passwordSet) {
    return { passwordMode: true, email };
  }

  // Authorized staff member without a password set yet -> send branded setup link
  const result = await sendPasswordSetupEmailAction(email, "admin");
  if (!result.ok && result.error) {
    return { error: result.error };
  }

  return { sent: true, email };
}

/**
 * Step 2 (password branch): sign in with password.
 */
export async function signInAdminWithPasswordAction(
  _prevState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!password) {
    return { passwordMode: true, email, error: "Enter your password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      passwordMode: true,
      email,
      error: "Incorrect password. Please try again or use 'Forgot password'.",
    };
  }

  redirect("/admin");
}

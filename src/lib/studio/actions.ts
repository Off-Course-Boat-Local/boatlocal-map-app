"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserLoginProfileState } from "@/lib/auth/passwordStatus";
import { sendPasswordSetupEmailAction } from "@/lib/auth/passwordActions";

export interface StudioLoginState {
  error?: string;
  sent?: boolean;
  passwordMode?: boolean;
  email?: string;
}

function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Step 1 for Studio sign-in:
 * - Checks if account exists. If not, returns clear feedback.
 * - If account exists and has a password -> returns passwordMode: true.
 * - If account exists without a password -> sends branded setup link.
 */
export async function checkStudioLoginMethodAction(
  _prevState: StudioLoginState,
  formData: FormData,
): Promise<StudioLoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!isPlausibleEmail(email)) {
    return { error: "Enter a valid email address." };
  }

  const userState = await getUserLoginProfileState(email, "studio");

  if (!userState.exists) {
    return {
      error: "No account found with this email address. Please check for typos or contact your company administrator for an invite.",
    };
  }

  if (userState.passwordSet) {
    return { passwordMode: true, email };
  }

  // Account exists, but no password set yet -> send branded password setup link
  const result = await sendPasswordSetupEmailAction(email, "studio");
  if (!result.ok && result.error) {
    return { error: result.error };
  }

  return { sent: true, email };
}

/**
 * Step 2 for Studio sign-in:
 * Validates password and sets the session.
 */
export async function signInStudioWithPasswordAction(
  _prevState: StudioLoginState,
  formData: FormData,
): Promise<StudioLoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!password) {
    return { passwordMode: true, email, error: "Enter your password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      passwordMode: true,
      email,
      error: "Incorrect password. Please try again or use 'Forgot password'.",
    };
  }

  redirect("/studio");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/studio/login");
}

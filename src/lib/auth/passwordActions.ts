"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailBaseUrl, sendEmail, isEmailConfigured } from "@/lib/email/client";
import { passwordResetEmail, setPasswordEmail } from "@/lib/email/templates";
import { getUserLoginProfileState } from "./passwordStatus";

export interface AuthActionResult {
  ok?: boolean;
  error?: string;
  sent?: boolean;
}

/**
 * Step 2: Signs in with email and password, setting the session cookie.
 */
export async function signInWithPasswordAction(
  email: string,
  password: string,
  redirectTo: string = "/studio",
): Promise<AuthActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    return { ok: false, error: "Incorrect password. Please try again or reset your password." };
  }

  redirect(redirectTo);
}

/**
 * Sends a branded password reset email.
 */
export async function requestPasswordResetAction(
  email: string,
  portal: "admin" | "studio" = "studio",
): Promise<AuthActionResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const userState = await getUserLoginProfileState(normalizedEmail, portal);

  if (!userState.exists) {
    return {
      ok: false,
      error: "No account found with this email address. Please check for typos or ask your administrator for an invite.",
    };
  }

  const baseUrl = emailBaseUrl();
  const admin = createAdminClient();

  try {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: {
        redirectTo: `${baseUrl}/set-password?portal=${portal}`,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      // Fallback if generateLink is restricted: standard supabase reset
      const supabase = await createClient();
      await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${baseUrl}/auth/confirm?next=/set-password`,
      });
      return { sent: true, ok: true };
    }

    const resetUrl = linkData.properties.action_link;

    if (isEmailConfigured()) {
      await sendEmail({
        to: normalizedEmail,
        ...passwordResetEmail({ email: normalizedEmail, resetUrl, baseUrl }),
      });
    } else {
      console.log("[DEV PASSWORD RESET LINK]:", resetUrl);
    }

    return { sent: true, ok: true };
  } catch (err) {
    console.error("[requestPasswordResetAction error]:", err);
    return { ok: false, error: "Failed to send password reset email. Please try again later." };
  }
}

/**
 * Sends a branded password setup email for an active account that has no password yet.
 */
export async function sendPasswordSetupEmailAction(
  email: string,
  portal: "admin" | "studio" = "studio",
): Promise<AuthActionResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const baseUrl = emailBaseUrl();
  const admin = createAdminClient();

  try {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
      options: {
        redirectTo: `${baseUrl}/set-password?portal=${portal}`,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      const supabase = await createClient();
      await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${baseUrl}/auth/confirm?next=/set-password`,
        },
      });
      return { sent: true, ok: true };
    }

    const setupUrl = linkData.properties.action_link;

    if (isEmailConfigured()) {
      await sendEmail({
        to: normalizedEmail,
        ...setPasswordEmail({ email: normalizedEmail, setupUrl, baseUrl }),
      });
    } else {
      console.log("[DEV PASSWORD SETUP LINK]:", setupUrl);
    }

    return { sent: true, ok: true };
  } catch (err) {
    console.error("[sendPasswordSetupEmailAction error]:", err);
    return { ok: false, error: "Failed to send sign-in link. Please try again." };
  }
}

/**
 * Sets or updates the user's password once signed in via recovery/magic-link.
 */
export async function updatePasswordAction(password: string): Promise<AuthActionResult> {
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters long." };
  }

  const supabase = await createClient();
  const { data: authData, error: updateError } = await supabase.auth.updateUser({ password });

  if (updateError || !authData.user) {
    return { ok: false, error: updateError?.message || "Failed to update password." };
  }

  // Mark password_set = true in profiles table
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ password_set: true })
    .eq("id", authData.user.id);

  return { ok: true };
}

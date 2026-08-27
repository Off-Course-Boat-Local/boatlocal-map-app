import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailAllowlistedForAdmin } from "@/lib/admin/allowlist";

export interface UserLoginProfileState {
  exists: boolean;
  role: "admin" | "company" | "guide" | null;
  passwordSet: boolean;
}

/**
 * Checks whether an account exists in the platform (Admin staff, Company Owner, or Guide)
 * and whether they have set a password.
 */
export async function getUserLoginProfileState(
  email: string,
  scope: "admin" | "studio" | "any" = "any",
): Promise<UserLoginProfileState> {
  const normalizedEmail = email.trim().toLowerCase();
  const admin = createAdminClient();

  // 1. Check profiles table
  const { data: profile } = await admin
    .from("profiles")
    .select("role, password_set")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (profile) {
    if (scope === "admin" && profile.role !== "admin") {
      return { exists: false, role: null, passwordSet: false };
    }
    if (scope === "studio" && profile.role === "admin") {
      return { exists: false, role: null, passwordSet: false };
    }
    return {
      exists: true,
      role: profile.role as "admin" | "company" | "guide",
      passwordSet: profile.password_set ?? false,
    };
  }

  // 2. If checking for admin, also check the environment allowlist
  if (scope === "admin" || scope === "any") {
    if (isEmailAllowlistedForAdmin(normalizedEmail)) {
      return { exists: true, role: "admin", passwordSet: false };
    }
  }

  // 3. If checking for studio/company, check companies table for owner_email
  if (scope === "studio" || scope === "any") {
    const { data: company } = await admin
      .from("companies")
      .select("id")
      .eq("owner_email", normalizedEmail)
      .maybeSingle();

    if (company) {
      return { exists: true, role: "company", passwordSet: false };
    }
  }

  return { exists: false, role: null, passwordSet: false };
}

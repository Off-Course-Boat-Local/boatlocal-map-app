"use server";

// DEV AUTH STAND-IN — see src/lib/admin/devAuth.ts for what this file
// becomes once real Supabase Auth exists (a real sign-in call instead of
// verifyDevCredentials()).
//
// This action is, in effect, a public POST endpoint: it re-verifies the
// submitted credentials itself and does not trust anything about how it was
// reached, per the "every Server Action re-verifies" rule.

import { redirect } from "next/navigation";

import { createAdminSession, verifyDevCredentials } from "@/lib/admin/devAuth";

export async function login(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!verifyDevCredentials(email, password)) {
    redirect("/admin/login?error=1");
  }

  await createAdminSession(email);
  redirect("/admin");
}

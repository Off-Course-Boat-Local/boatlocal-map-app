"use server";

// DEV AUTH STAND-IN — see src/lib/admin/devAuth.ts.

import { redirect } from "next/navigation";

import { destroyAdminSession } from "@/lib/admin/devAuth";

export async function logout(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}

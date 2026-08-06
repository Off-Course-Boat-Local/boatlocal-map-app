"use server";

// Session handling lives in src/lib/admin/devAuth.ts (real Supabase auth,
// despite the filename — see that file's header for why it kept the name).

import { redirect } from "next/navigation";

import { destroyAdminSession } from "@/lib/admin/devAuth";

export async function logout(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}

"use server";

// DEV AUTH STAND-IN
//
// The two Server Actions the login/logout UI calls. Split out of devAuth.ts
// because cookies can only be *set* from a Server Action or Route Handler —
// never during a Server Component's render (see the `cookies()` docs) — so
// every write to the session cookie has to live behind a `"use server"`
// boundary. devAuth.ts stays importable from Server Components (which may
// only *read* cookies) precisely because it has no directive of its own.
//
// Replace wholesale when real Supabase Auth exists: loginAction becomes
// `supabase.auth.signInWithPassword(...)`, logoutAction becomes
// `supabase.auth.signOut()`, and the manual company/guide lookups below
// disappear because the session already carries that identity.

import { redirect } from "next/navigation";

import { getCompanyRecord, getGuidesForCompany } from "@/lib/data/source";
import {
  DEV_LOGIN_PASSWORD,
  clearDevSession,
  persistDevSession,
  type DevSession,
  type StudioRole,
} from "./devAuth";

// The only tenant seeded in the fake store today (see fakeStore.ts /
// supabase/seed.sql). A real login resolves the company from the
// authenticated user's own profile row, never from a hardcoded subdomain —
// this constant disappears along with the rest of this file's guesswork.
const DEV_TENANT_SUBDOMAIN = "coastal";

export interface LoginActionState {
  error?: string;
}

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as StudioRole | "";

  if (!email) return { error: "Enter an email address." };
  if (role !== "company" && role !== "guide") return { error: "Choose a role." };
  if (password !== DEV_LOGIN_PASSWORD) {
    return { error: `Wrong password — the dev stand-in password is "${DEV_LOGIN_PASSWORD}".` };
  }

  const company = await getCompanyRecord(DEV_TENANT_SUBDOMAIN);
  if (!company) return { error: "No company seeded in the fake store." };

  let session: DevSession;

  if (role === "company") {
    session = { role: "company", email, companyId: company.id, companyName: company.name };
  } else {
    // Admin-scoped purely to resolve *which* guide this dev login means —
    // a real login derives the guide id from the authenticated user's own
    // profile row, never from an admin-level query like this one.
    const guides = await getGuidesForCompany({ role: "admin" }, company.id);
    const guide =
      guides.find((g) => g.email.toLowerCase() === email.toLowerCase()) ?? guides[0];
    if (!guide) return { error: "No guide seeded for this company." };

    session = {
      role: "guide",
      email,
      companyId: company.id,
      companyName: company.name,
      guideId: guide.id,
      guideName: guide.name,
    };
  }

  await persistDevSession(session);
  redirect("/studio");
}

export async function logoutAction(): Promise<void> {
  await clearDevSession();
  redirect("/studio/login");
}

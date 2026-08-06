// Studio auth — real Supabase Auth, gated by invite/onboarding rather than
// self-serve sign-up.
//
// getDevSession()/requireDevSession()/requireCompanyRole()/requireGuideRole()
// keep their original names and signatures on purpose (this module used to
// carry a header comment describing exactly this migration:
// "getDevSession() -> read auth.getUser()/a verified session, then look up
// the profiles row for role + company_id"). Every page under
// src/app/studio/(protected)/ and every Server Action in src/lib/studio/
// already imports these exact functions and expects exactly the DevSession
// shape defined in ./session.ts — only what happens inside them changes
// here, so none of those call sites need to change at all.
//
// getDevSession() verifies the caller's Supabase Auth JWT with
// `getClaims()` (signature-checked against Supabase's public keys) — never
// `getSession()`, which only reads local cookie state without revalidating
// against the Auth server — then resolves the caller's own `profiles` row
// (role, company_id, guide_id) plus the company/guide names it points at,
// via the anon-key request-scoped client from src/lib/supabase/server.ts.
// That client carries the signed-in user's session, so this read goes
// through RLS as that user (`self_select` on profiles, `company_and_
// guide_select_own` on companies, `guide_select_self` on guides — see
// supabase/migrations/20260805063611_rls_policies.sql) rather than needing
// the service-role admin client at all.
//
// No profile row ever gets created as a side effect of signing in here:
// Studio is invite-gated, not self-serve (see src/app/join/[token]/
// actions.ts for the guide-invite path, and Admin's company-onboarding flow
// for a company's first user). An authenticated caller with no profiles
// row — or an admin-role profile, which Studio doesn't recognise, see
// DevSession's own comment — simply has no Studio session.
//
// SERVER-ONLY: pulls in src/lib/supabase/server.ts, which imports
// `next/headers`, so this must never be imported from a Client Component.

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import type { DevSession } from "./session";

export { actorFromSession, type DevSession, type StudioRole } from "./session";

/** Reads the current session, if any. Safe to call from any Server Component. */
export async function getDevSession(): Promise<DevSession | null> {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email, company_id, guide_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || !profile.company_id) return null;
  // role === "admin" (or a malformed row profile_role_shape should have
  // prevented) — Studio doesn't recognise either.
  if (profile.role !== "company" && profile.role !== "guide") return null;

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", profile.company_id)
    .maybeSingle();
  if (!company) return null;

  if (profile.role === "company") {
    return {
      role: "company",
      email: profile.email,
      companyId: profile.company_id,
      companyName: company.name,
    };
  }

  // profile.role === "guide"
  if (!profile.guide_id) return null;

  const { data: guide } = await supabase
    .from("guides")
    .select("name")
    .eq("id", profile.guide_id)
    .maybeSingle();
  if (!guide) return null;

  return {
    role: "guide",
    email: profile.email,
    companyId: profile.company_id,
    companyName: company.name,
    guideId: profile.guide_id,
    guideName: guide.name,
  };
}

/**
 * Belt-and-braces layer #2 (layout/page level) from the routing research
 * notes: redirects to /studio/login if there is no session. Layer #1
 * (src/proxy.ts) is a coarse pre-render check; layer #3 is every Server
 * Action re-checking for itself (see e.g. src/lib/studio/guideActions.ts).
 */
export async function requireDevSession(): Promise<DevSession> {
  const session = await getDevSession();
  if (!session) {
    redirect("/studio/login");
  }
  return session;
}

/** Redirects away (to the Dashboard) unless the session is a "company" actor. Use at the top of company-only pages: Branding, Guides, Boat tours, Campaign, Report. */
export function requireCompanyRole(
  session: DevSession,
): asserts session is Extract<DevSession, { role: "company" }> {
  if (session.role !== "company") {
    redirect("/studio");
  }
}

/** Redirects away (to the Dashboard) unless the session is a "guide" actor. Use at the top of guide-only pages: Link & QR / Stats. */
export function requireGuideRole(
  session: DevSession,
): asserts session is Extract<DevSession, { role: "guide" }> {
  if (session.role !== "guide") {
    redirect("/studio");
  }
}

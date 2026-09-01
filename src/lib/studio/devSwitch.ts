// LOCALHOST-ONLY company switcher — founder request, 2026-09-01: working
// across two personal machines plus a remote developer, wants to hop into
// ANY company's Studio instantly while developing, with no login step at
// all — not even the one-click "sign in as this email" version.
//
// Same trust model as src/lib/admin/devBypass.ts: this mints a REAL
// Supabase Auth session (generateLink + verifyOtp), never a forged cookie,
// so every RLS-gated Studio read (getDevSession, company/guide queries)
// works exactly like a genuine login. What's different from devBypass.ts
// is that a company may not have a claimed owner account yet — Studio is
// invite-gated (see src/app/join/[token]/actions.ts's own comment), so
// there's no guarantee a `profiles` row exists to sign in as.
//
// For that case this provisions the exact same shape redeemCompanyOwnerInvite
// (src/app/join/[token]/actions.ts) creates when a real owner redeems their
// invite link: an auth user + a `profiles` row with role='company'. This
// module is the dev-only shortcut to that same end state, not a different
// mechanism — the app already trusts "an auth user + profiles row with
// role=company" as what makes someone a legitimate Studio company user.
//
// Triple-gated to non-production, same as devBypass.ts:
//   1. NODE_ENV !== "production" checked here, hard — throws otherwise.
//   2. The switcher UI (DevCompanySwitcher.tsx) only renders when the same
//      check passes server-side (it never reaches the client bundle).
//   3. Vercel's production deployment always sets NODE_ENV=production, so
//      this throws immediately even if someone found the action directly.

import "server-only";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface DevSwitchCompany {
  id: string;
  name: string;
  hasOwner: boolean;
}

/** Every company, for the localhost switcher's picker list. Throws in production. */
export async function listCompaniesForDevSwitch(): Promise<DevSwitchCompany[]> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dev company switcher is disabled in production.");
  }

  const admin = createAdminClient();
  const { data: companies, error } = await admin
    .from("companies")
    .select("id, name")
    .order("name", { ascending: true });
  if (error || !companies) return [];

  const { data: ownerProfiles } = await admin
    .from("profiles")
    .select("company_id")
    .eq("role", "company");
  const companiesWithOwners = new Set((ownerProfiles ?? []).map((p) => p.company_id));

  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    hasOwner: companiesWithOwners.has(c.id),
  }));
}

/**
 * Signs the caller into the given company's Studio instantly — no invite,
 * no password, no email round trip. If the company has no owner account
 * yet, provisions one first (same shape as a redeemed owner invite; see
 * this file's header comment). Throws in production.
 *
 * Plain function, not itself a Server Action: this module is `server-only`,
 * which a Client Component may never import even transitively. The "use
 * server" boundary a Client Component actually calls is the thin wrapper
 * in devSwitchActions.ts.
 */
export async function enterCompanyStudio(companyId: string): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dev company switcher is disabled in production.");
  }

  const admin = createAdminClient();

  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle();
  if (companyError || !company) {
    throw new Error("Company not found.");
  }

  // Prefer an existing owner profile — reuse the real account if this
  // company has already been claimed for real.
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("email")
    .eq("company_id", companyId)
    .eq("role", "company")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let email: string;

  if (existingProfile) {
    email = existingProfile.email.toLowerCase();
  } else {
    // Deliberately NOT companies.owner_email: that address may belong to a
    // real person who already has an unrelated auth identity elsewhere in
    // this app (e.g. an Admin account) — profiles.id is a 1:1 primary key
    // against auth.users.id, so a second role can never be attached to that
    // same user. A synthesized, company-scoped address sidesteps that
    // entirely and stays stable across repeated switches (same email ->
    // same auth user -> same profile).
    email = `dev-owner+${companyId}@localhost.boatlocal.dev`;

    let userId: string | null = null;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
    });

    if (created?.user) {
      userId = created.user.id;
    } else if (createError && /already/i.test(createError.message)) {
      const { data: usersPage } = await admin.auth.admin.listUsers();
      userId = usersPage?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    }

    if (!userId) {
      throw new Error("Could not provision a Studio account for this company.");
    }

    const { data: profileRow } = await admin
      .from("profiles")
      .select("id, role, company_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileRow && (profileRow.role !== "company" || profileRow.company_id !== companyId)) {
      throw new Error(
        "The dev account for this company is already linked to a different role — this shouldn't happen.",
      );
    }

    if (!profileRow) {
      const { error: profileError } = await admin.from("profiles").insert({
        id: userId,
        role: "company",
        company_id: companyId,
        email,
        display_name: company.name,
      });
      if (profileError) {
        throw new Error("Could not finish provisioning this company's Studio account.");
      }
    }
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    throw linkError ?? new Error("Could not generate a sign-in link.");
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyError) throw verifyError;

  redirect("/studio");
}

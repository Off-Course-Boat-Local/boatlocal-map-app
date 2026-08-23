// Real-Supabase integration test — run via `npm run test:integration`
// (vitest.config.integration.ts), NEVER via plain `npm test` (see
// src/lib/data/source.integration.test.ts's header comment for the full
// explanation of why, and for the shared conventions this file follows).
//
// Scope: proves profiles.password_set is actually guarded the way
// supabase/migrations/20260823160000_admin_password_set.sql claims —
// something no fake-store/pure-logic unit test can touch, since the
// enforcement lives entirely in a Postgres trigger + RLS, not in app code.
//   1. The admin's OWN authenticated session cannot flip its own
//      password_set (rejected by profiles_guard_privileged_columns, same as
//      it already rejects a self role/company_id/guide_id change).
//   2. The service-role client — the only path
//      src/app/admin/set-password/actions.ts actually uses — can.
//
// Creates one throwaway auth user + profile row and deletes both again in
// this file's own afterAll, regardless of pass/fail, so repeated runs never
// accumulate junk in the real project.

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

function anonClient() {
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe("profiles.password_set guard (real Postgres trigger + RLS)", () => {
  const email = `admin-password-set-guard-${Date.now()}@example.invalid`;
  const password = "correct horse battery staple";
  let userId: string;

  beforeAll(async () => {
    const admin = adminClient();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created?.user) {
      throw new Error(`Could not create throwaway auth user for this test: ${createError?.message}`);
    }
    userId = created.user.id;

    // Direct service-role insert (bypasses RLS/trigger, same as devAuth.ts's
    // allowlisted-first-sign-in path) — password_set defaults to false.
    const { error: profileError } = await admin
      .from("profiles")
      .insert({ id: userId, role: "admin", email });
    if (profileError) {
      throw new Error(`Could not create throwaway admin profile for this test: ${profileError.message}`);
    }
  });

  afterAll(async () => {
    if (!userId) return;
    // Cascades to the profiles row (profiles.id references auth.users(id)
    // on delete cascade — supabase/migrations/20260805063610_init_schema.sql).
    await adminClient().auth.admin.deleteUser(userId);
  });

  it("starts with password_set = false", async () => {
    const { data } = await adminClient()
      .from("profiles")
      .select("password_set")
      .eq("id", userId)
      .single();
    expect(data?.password_set).toBe(false);
  });

  it("rejects the admin flipping its own password_set via its own authenticated session", async () => {
    const asAdmin = anonClient();
    const { error: signInError } = await asAdmin.auth.signInWithPassword({ email, password });
    expect(signInError).toBeNull();

    const { error } = await asAdmin.from("profiles").update({ password_set: true }).eq("id", userId);

    // profiles_guard_privileged_columns raises errcode 42501 with this
    // message (supabase/migrations/20260823160000_admin_password_set.sql) —
    // PostgREST surfaces it back to the client rather than silently no-op'ing.
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not self-editable/);

    await asAdmin.auth.signOut();

    const { data: after } = await adminClient()
      .from("profiles")
      .select("password_set")
      .eq("id", userId)
      .single();
    expect(after?.password_set).toBe(false);
  });

  it("allows the service-role client to flip password_set — the only path src/app/admin/set-password/actions.ts uses", async () => {
    const { error } = await adminClient()
      .from("profiles")
      .update({ password_set: true })
      .eq("id", userId);
    expect(error).toBeNull();

    const { data } = await adminClient()
      .from("profiles")
      .select("password_set")
      .eq("id", userId)
      .single();
    expect(data?.password_set).toBe(true);
  });
});

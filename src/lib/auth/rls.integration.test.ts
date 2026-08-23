// Real-Supabase integration test — run via `npm run test:integration` only
// (see vitest.config.integration.ts's header comment). Proves two things
// unit tests against src/lib/data/fakeStore.ts structurally cannot:
//
//   1. Row Level Security is actually enforced by Postgres for a REAL
//      signed-in identity — not a `StudioActor` object source.ts trusts by
//      construction, but an actual JWT verified by `getClaims()`/RLS.
//   2. The magic-link sign-in flow itself works end-to-end against the real
//      Auth server, using `supabase.auth.admin.generateLink()` +
//      `verifyOtp()` so no real inbox is needed (see the research this task
//      was scoped from).
//
// Fixture isolation: every row this file creates is tagged with one
// run-scoped id (`RUN_ID`, embedded in emails/names), asserts only against
// its own rows, and deletes everything it created in `afterAll` via
// try/finally — so a killed run leaves identifiable, prunable junk (grep
// any table for `RUN_ID`) rather than silently colliding with a concurrent
// run or accumulating unbounded garbage.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

function freshAnonClient(): SupabaseClient {
  // A distinct client per identity (never the shared module-level one
  // source.ts uses) — auth state must not bleed between "guide A" and
  // "no session" in these tests.
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
}

interface CompanyFixture {
  id: string;
}

async function insertCompany(admin: SupabaseClient, label: string): Promise<CompanyFixture> {
  const { data, error } = await admin
    .from("companies")
    .insert({
      name: `RLS Test Co ${RUN_ID} ${label}`,
      company_type: "hotel",
      app_name: "RLS Test",
      brand_primary: "#112233",
      brand_primary_dark: "#112233",
      brand_accent: "#112233",
      brand_surround: "#112233",
      status: "active",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data as CompanyFixture;
}

describe("RLS enforcement + magic-link sign-in against the real Supabase project", () => {
  const admin = adminClient();

  let companyA: CompanyFixture;
  let companyB: CompanyFixture;
  let guideAId: string;
  let guideAUserId: string;
  let guideAEmail: string;
  let companyBRecommendationId: string;
  let companyARecommendationId: string;
  let asGuideA: SupabaseClient;
  let magicLinkSession: { accessToken: string; refreshToken: string; userId: string; email: string };

  beforeAll(async () => {
    companyA = await insertCompany(admin, "a");
    companyB = await insertCompany(admin, "b");

    const { data: guideRow, error: guideError } = await admin
      .from("guides")
      .insert({
        company_id: companyA.id,
        name: `RLS Test Guide ${RUN_ID}`,
        email: `rls-guide-${RUN_ID}@example.invalid`,
        slug: `rls-guide-${RUN_ID}`,
        avatar_initial: "R",
        welcome_message: "",
        status: "active",
      })
      .select("id")
      .single();
    if (guideError) throw guideError;
    guideAId = guideRow.id as string;

    // One recommendation under each tenant, so the isolation assertions have
    // real rows to fail to see, not just an already-empty table.
    const { data: recB, error: recBError } = await admin
      .from("recommendations")
      .insert({
        company_id: companyB.id,
        owner_type: "company",
        category: "coffee",
        name: `Company B secret spot ${RUN_ID}`,
        area: "Nowhere",
        address: "1 Test Street",
        lng: 4.9,
        lat: 52.37,
        note: "Should never be visible to a Company A guide.",
      })
      .select("id")
      .single();
    if (recBError) throw recBError;
    companyBRecommendationId = recB.id as string;

    const { data: recA, error: recAError } = await admin
      .from("recommendations")
      .insert({
        company_id: companyA.id,
        owner_type: "company",
        category: "coffee",
        name: `Company A base list spot ${RUN_ID}`,
        area: "Somewhere",
        address: "2 Test Street",
        lng: 4.9,
        lat: 52.37,
        note: "Guide should be able to read this (own tenant base list).",
      })
      .select("id")
      .single();
    if (recAError) throw recAError;
    companyARecommendationId = recA.id as string;

    // --- Real auth user + profile, linked to guide A -----------------------
    guideAEmail = `rls-auth-${RUN_ID}@example.invalid`;
    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email: guideAEmail,
      email_confirm: true,
    });
    if (createUserError) throw createUserError;
    guideAUserId = createdUser.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: guideAUserId,
      role: "guide",
      company_id: companyA.id,
      guide_id: guideAId,
      email: guideAEmail,
    });
    if (profileError) throw profileError;

    // --- Magic-link sign-in, no real inbox needed ---------------------------
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: guideAEmail,
    });
    if (linkError) throw linkError;

    const anonForSignIn = freshAnonClient();
    const { data: verifyData, error: verifyError } = await anonForSignIn.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });
    if (verifyError) throw verifyError;
    if (!verifyData.session) throw new Error("verifyOtp succeeded but returned no session.");

    magicLinkSession = {
      accessToken: verifyData.session.access_token,
      refreshToken: verifyData.session.refresh_token,
      userId: verifyData.session.user.id,
      email: verifyData.session.user.email ?? "",
    };

    // A second, independent client carrying guide A's real session — every
    // RLS assertion below queries through THIS client, exactly as Postgres
    // would see requests from guide A's own browser.
    asGuideA = freshAnonClient();
    const { error: setSessionError } = await asGuideA.auth.setSession({
      access_token: magicLinkSession.accessToken,
      refresh_token: magicLinkSession.refreshToken,
    });
    if (setSessionError) throw setSessionError;
  }, 30_000);

  afterAll(async () => {
    // Best-effort, order-sensitive (children before parents) cleanup. Each
    // delete is independently try/caught so one failure doesn't strand the
    // rest — this file's own RUN_ID tag means anything left behind is still
    // identifiable and prunable later.
    const cleanupSteps: Array<() => PromiseLike<unknown>> = [
      () => admin.from("recommendations").delete().eq("id", companyBRecommendationId),
      () => admin.from("recommendations").delete().eq("id", companyARecommendationId),
      () => (guideAUserId ? admin.auth.admin.deleteUser(guideAUserId) : Promise.resolve()),
      () => admin.from("profiles").delete().eq("id", guideAUserId),
      () => admin.from("guides").delete().eq("id", guideAId),
      () => admin.from("companies").delete().eq("id", companyA?.id),
      () => admin.from("companies").delete().eq("id", companyB?.id),
    ];
    for (const step of cleanupSteps) {
      try {
        await step();
      } catch (err) {
        console.warn(`RLS integration test cleanup step failed (RUN_ID=${RUN_ID}):`, err);
      }
    }
  }, 30_000);

  describe("magic-link sign-in flow (generateLink + verifyOtp)", () => {
    it("produces a real, usable session for the invited user, without any inbox", () => {
      expect(magicLinkSession.userId).toBe(guideAUserId);
      expect(magicLinkSession.email).toBe(guideAEmail);
      expect(magicLinkSession.accessToken).toBeTruthy();
    });

    it("the resulting client is genuinely authenticated (auth.getUser round-trips)", async () => {
      const { data, error } = await asGuideA.auth.getUser();
      expect(error).toBeNull();
      expect(data.user?.id).toBe(guideAUserId);
      expect(data.user?.email).toBe(guideAEmail);
    });
  });

  describe("RLS: guide A's real session can never see company B's data", () => {
    it("cannot read company B's row at all (guest_public_read/company_and_guide_select_own both exclude it)", async () => {
      const { data, error } = await asGuideA.from("companies").select("*").eq("id", companyB.id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("cannot read company B's recommendations, even filtering directly by its id", async () => {
      const { data, error } = await asGuideA
        .from("recommendations")
        .select("*")
        .eq("id", companyBRecommendationId);
      expect(error).toBeNull();
      // Not a permission error — RLS makes the row simply not exist for this
      // session, exactly like a 0-row query. This is the behavior to prove:
      // an "invisible" row, not a denied query.
      expect(data).toEqual([]);
    });

    it("cannot insert a recommendation into company B's tenant", async () => {
      const { error } = await asGuideA.from("recommendations").insert({
        company_id: companyB.id,
        owner_type: "guide",
        guide_id: guideAId,
        category: "coffee",
        name: "Attempted cross-tenant write",
        area: "Nowhere",
        address: "1 Test Street",
        lng: 4.9,
        lat: 52.37,
        note: "This insert must be rejected by RLS.",
      });
      expect(error).not.toBeNull();
    });
  });

  describe("RLS: guide A's real session CAN see its own tenant (positive control)", () => {
    it("reads its own company's row", async () => {
      const { data, error } = await asGuideA.from("companies").select("*").eq("id", companyA.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]?.id).toBe(companyA.id);
    });

    it("reads its own tenant's base-list recommendation (read-only inherited access)", async () => {
      const { data, error } = await asGuideA
        .from("recommendations")
        .select("*")
        .eq("id", companyARecommendationId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("can insert its own personal recommendation under its own tenant", async () => {
      const { data, error } = await asGuideA
        .from("recommendations")
        .insert({
          company_id: companyA.id,
          owner_type: "guide",
          guide_id: guideAId,
          category: "coffee",
          name: `Guide A's own spot ${RUN_ID}`,
          area: "Somewhere",
          address: "3 Test Street",
          lng: 4.9,
          lat: 52.37,
          note: "Guide A is allowed to write its own items.",
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();

      // Extend cleanup to this newly-created row too.
      if (data?.id) {
        await admin.from("recommendations").delete().eq("id", data.id);
      }
    });
  });
});

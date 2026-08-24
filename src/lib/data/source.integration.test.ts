// Real-Supabase integration test — run via `npm run test:integration`
// (vitest.config.integration.ts), NEVER via plain `npm test` (see that
// config's header comment for why source.ts's fake-vs-real branch actually
// flips here). Hits the live Supabase project configured in .env.local.
//
// Scope, deliberately narrow: this is NOT re-testing every behavior
// src/lib/data/source.test.ts already covers against the fake store — it's
// proving a handful of the real Supabase-backed queries actually work
// against the real schema/RPCs (correct table/column names, RPC signatures,
// join shapes), which the fake-store suite can never catch since it never
// touches Postgres.
//
// Fixture: reads the project's existing seed data (supabase/seed.sql — one
// company "coastal", one guide "jan", 6 boat tours, 14 recommendations) as
// read-only fixtures. The one write this file performs (recordEvent) inserts
// a uniquely-marked row and deletes it again in the same test, so repeated
// runs never accumulate junk.
import { createClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  getActiveCompanyRecord,
  getBoatTours,
  getCompanyBrand,
  getGuide,
  getMapPins,
  getPlaces,
  recordBookingOutcome,
  recordEvent,
  recordGuestReview,
} from "./source";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

describe("source.ts round-tripping against the real Supabase project", () => {
  let companyId: string;

  beforeAll(async () => {
    // Companies have no human-typed identifier any more (see
    // 20260823160000_drop_company_subdomain.sql) — supabase/seed.sql seeds
    // this exact fixed id, matching src/lib/data/fakeStore.ts's own
    // COMPANY_ID, so this looks the seed row up directly rather than by a
    // no-longer-existent column.
    const seededCompanyId = "11111111-1111-1111-1111-111111111111";
    const { data, error } = await adminClient()
      .from("companies")
      .select("id")
      .eq("id", seededCompanyId)
      .single();
    if (error || !data) {
      throw new Error(
        `Seed company ${seededCompanyId} not found in the real database (is it seeded? ` +
          `see supabase/seed.sql) — ${error?.message ?? "no row returned"}`,
      );
    }
    companyId = data.id as string;
  });

  it("getCompanyBrand: plain select returns the seeded brand", async () => {
    const brand = await getCompanyBrand(companyId);
    expect(brand).not.toBeNull();
    expect(brand?.appName).toBeTruthy();
    expect(brand?.primary).toMatch(/^#/);
  });

  it("getCompanyBrand: unknown company id returns null, not an error", async () => {
    const brand = await getCompanyBrand("00000000-0000-0000-0000-000000000000");
    expect(brand).toBeNull();
  });

  it("getActiveCompanyRecord: plain select returns the seeded active company", async () => {
    const record = await getActiveCompanyRecord(companyId);
    expect(record).not.toBeNull();
    expect(record?.status).toBe("active");
    expect(record?.id).toBe(companyId);
  });

  it("getGuide: RPC guide_by_slug returns the seeded guide 'jan'", async () => {
    const guide = await getGuide(companyId, "jan");
    expect(guide).not.toBeNull();
    expect(guide?.slug).toBe("jan");
  });

  // FIXED REAL BUG, originally caught by this integration test: per real
  // Postgres `language sql` function semantics, a function declared to
  // `returns` a single composite row still returns exactly one row — with
  // every column NULL — when its inner `select ... limit 1` matches zero
  // rows, rather than zero rows. public.guide_by_slug() used to be declared
  // that way (as was public.company_by_subdomain(), before getCompanyBrand
  // switched to a plain select — see that function's own comment in
  // src/lib/data/source.ts), so supabase-js's `.rpc()` handed source.ts a
  // non-null object of nulls for a zero-match lookup instead of `null`/no
  // rows. Fixed in supabase/migrations/20260805063612_helper_functions.sql
  // by dropping and recreating the function as `returns setof
  // public.guides` (create-or-replace can't change a function's return
  // type, hence the explicit drop) plus the corresponding array-unwrap in
  // getGuide's real branch. This assertion documents the contract (`Guide |
  // null`, matching the fakeStore branch and this function's own return
  // type) and now passes for real.
  it("getGuide: wrong slug returns null, not an error", async () => {
    const guide = await getGuide(companyId, "not-a-real-guide-slug");
    expect(guide).toBeNull();
  });

  it("getPlaces: plain select against recommendations returns seeded visible rows", async () => {
    const places = await getPlaces(companyId);
    expect(places.length).toBeGreaterThan(0);
    for (const place of places) {
      expect(place.category).toBeTruthy();
    }
  });

  it("getBoatTours: company_boat_features join to boat_tours returns seeded featured tours", async () => {
    const tours = await getBoatTours(companyId);
    expect(tours.length).toBeGreaterThan(0);
    expect(tours.every((t) => typeof t.bookingUrl === "string")).toBe(true);
  });

  it("getMapPins: guest_map_pins RPC merges boats and places", async () => {
    const pins = await getMapPins(companyId);
    expect(pins.length).toBeGreaterThan(0);
    expect(pins.some((p) => p.isBoat)).toBe(true);
    expect(pins.some((p) => !p.isBoat)).toBe(true);
  });

  describe("recordEvent", () => {
    const marker = `integration-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    afterAll(async () => {
      // Cleanup discipline: this test's own row is uniquely marked via
      // `metadata->>marker`, so this delete can never touch another test
      // run's row (or any real event), even if two runs overlap.
      await adminClient().from("events").delete().eq("metadata->>marker", marker);
    });

    it("actually inserts a row into the real events table (anon insert-only policy)", async () => {
      await recordEvent({
        eventType: "app_open",
        companyId,
        platform: "desktop",
        metadata: { marker },
      });

      const { data, error } = await adminClient()
        .from("events")
        .select("*")
        .eq("metadata->>marker", marker);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]?.company_id).toBe(companyId);
      expect(data?.[0]?.event_type).toBe("app_open");
    });
  });

  describe("recordBookingOutcome fallback attribution — real-Postgres regression", () => {
    // REGRESSION, found by BoatLocal's team live-testing the deployed
    // webhook, not by this (or any prior) test: resolveFallbackAttribution
    // used to pass an unvalidated `sourceCompany` straight into
    // `.eq("id", sourceCompany)` against `companies.id`, a real `uuid`
    // column. Postgres raises a hard error for a non-UUID string compared
    // against a `uuid` column — it does NOT just return zero rows the way
    // the fake store's plain `===` string comparison does — so this exact
    // case passed against the fake store (src/lib/data/source.test.ts's
    // "never trusts an echoed company id that doesn't resolve to a real
    // company") while 500ing for real. Only an integration test against the
    // real database can actually catch this class of bug.
    const marker = (suffix: string) => `bkl_integration_regression_${suffix}`;

    afterAll(async () => {
      await adminClient()
        .from("events")
        .delete()
        .like("metadata->>bookingId", "INTEGRATION-TEST-FALLBACK-%");
    });

    it("a non-UUID source_company never throws — records as unattributed, same as the fake store", async () => {
      const result = await recordBookingOutcome({
        clickId: marker("company"),
        bookingId: "INTEGRATION-TEST-FALLBACK-company",
        event: "booking.confirmed",
        tourId: "sunset-canal",
        guests: 2,
        amountCents: 5600,
        currency: "EUR",
        bookedAt: new Date().toISOString(),
        sourceCompany: "TEST-CO",
      });
      expect(result).toEqual({ inserted: true, attributed: false });
    });

    it("a non-UUID source_distributor never throws — resolved by slug, not id, so garbage input just fails to match", async () => {
      const result = await recordBookingOutcome({
        clickId: marker("distributor"),
        bookingId: "INTEGRATION-TEST-FALLBACK-distributor",
        event: "booking.confirmed",
        tourId: "sunset-canal",
        guests: 2,
        amountCents: 5600,
        currency: "EUR",
        bookedAt: new Date().toISOString(),
        sourceCompany: companyId,
        sourceDistributor: "TEST-GUIDE-SLUG",
      });
      // Still attributed at the company level — an unresolvable guide slug
      // only drops the guide half, per resolveFallbackAttribution's own
      // doc comment.
      expect(result).toEqual({ inserted: true, attributed: true });
    });

    it("a real guide slug (not a UUID id) resolves correctly under the echoed company", async () => {
      const result = await recordBookingOutcome({
        clickId: marker("real-slug"),
        bookingId: "INTEGRATION-TEST-FALLBACK-real-slug",
        event: "booking.confirmed",
        tourId: "sunset-canal",
        guests: 2,
        amountCents: 5600,
        currency: "EUR",
        bookedAt: new Date().toISOString(),
        sourceCompany: companyId,
        sourceDistributor: "jan", // supabase/seed.sql's seeded guide's real slug
      });
      expect(result).toEqual({ inserted: true, attributed: true });
    });
  });

  describe("is_test tagging excludes rows from the real company_analytics_summary RPC", () => {
    // This is specifically here (not just in the fakeStore suite) to prove
    // the REAL `is_test = false` filter added to
    // 20260823240000_events_is_test_tag.sql's company_analytics_summary
    // actually excludes a tagged row — the fakeStore mirror can never catch
    // a wrong column name or a filter that silently no-ops in real SQL.
    //
    // Calls the RPC directly via the service-role client rather than through
    // getCompanyAnalyticsSummary: that wrapper's real branch goes through
    // authedClient() (src/lib/supabase/server.ts), which calls next/headers'
    // cookies() — this suite runs in a plain Node/Vitest environment with no
    // real Next.js request scope, so that call would throw before ever
    // reaching the RPC. company_analytics_summary is `security invoker` and
    // has no RLS-guarded read of its own beyond the plain `events` select
    // this migration's own WHERE clause performs, so calling it directly
    // here still genuinely exercises the real function body.
    const marker = `is-test-tag-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    afterAll(async () => {
      await adminClient().from("events").delete().eq("metadata->>marker", marker);
    });

    it("a booking recorded on a stubbed non-production deployment is tagged is_test and excluded from the RPC's sum", async () => {
      vi.stubEnv("VERCEL_ENV", "preview");
      await recordEvent({
        eventType: "boat_book_click",
        companyId,
        metadata: { clickId: `bkl_${marker}`, marker },
      });
      const result = await recordBookingOutcome({
        clickId: `bkl_${marker}`,
        bookingId: `BOOKING-${marker}`,
        event: "booking.confirmed",
        tourId: "sunset-canal",
        guests: 2,
        amountCents: 5600,
        currency: "EUR",
        bookedAt: new Date().toISOString(),
      });
      expect(result.inserted).toBe(true);

      // Confirm the row really was written with is_test = true — proves the
      // insert-side tagging, independent of the RPC's own filter below.
      const { data: rawRow, error: rawError } = await adminClient()
        .from("events")
        .select("is_test")
        .eq("metadata->>bookingId", `BOOKING-${marker}`)
        .single();
      expect(rawError).toBeNull();
      expect(rawRow?.is_test).toBe(true);

      const { data: summary, error: rpcError } = await adminClient().rpc(
        "company_analytics_summary",
        {
          p_company_id: companyId,
          p_from: new Date(Date.now() - 60_000).toISOString(),
          p_to: new Date(Date.now() + 60_000).toISOString(),
        },
      );
      expect(rpcError).toBeNull();
      const rows = (summary ?? []) as Array<{ event_type: string; event_count: number }>;
      expect(rows.find((r) => r.event_type === "booking_outcome")).toBeUndefined();
    });
  });

  describe("recordGuestReview — guest_reviews table (20260824000000_guest_reviews.sql)", () => {
    // guest_reviews has no jsonb metadata column to stash a unique marker in
    // (unlike `events`), so cleanup instead scopes by a captured start
    // timestamp — every row this describe block inserts (across all three
    // tests below) lands after `startedAt`, and the single afterAll sweeps
    // exactly that window for this seeded test company, never touching a
    // real guest's row from before the run.
    let startedAt: string;

    beforeAll(() => {
      startedAt = new Date().toISOString();
    });

    afterAll(async () => {
      await adminClient()
        .from("guest_reviews")
        .delete()
        .eq("company_id", companyId)
        .gte("created_at", startedAt);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("actually inserts a bare star-pick row (anon insert-only policy), with feedback_text/contact left null", async () => {
      await recordGuestReview({ companyId, rating: 5 });

      const { data, error } = await adminClient()
        .from("guest_reviews")
        .select("*")
        .eq("company_id", companyId)
        .gte("created_at", startedAt)
        .eq("rating", 5)
        .order("created_at", { ascending: false })
        .limit(1);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]?.feedback_text).toBeNull();
      expect(data?.[0]?.contact).toBeNull();
      expect(data?.[0]?.is_test).toBe(false);
    });

    it("actually inserts a private-feedback row with rating, feedback_text, and contact", async () => {
      await recordGuestReview({
        companyId,
        rating: 2,
        feedbackText: "Integration test feedback.",
        contact: "integration-test@example.com",
      });

      const { data, error } = await adminClient()
        .from("guest_reviews")
        .select("*")
        .eq("company_id", companyId)
        .gte("created_at", startedAt)
        .eq("rating", 2)
        .order("created_at", { ascending: false })
        .limit(1);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]?.feedback_text).toBe("Integration test feedback.");
      expect(data?.[0]?.contact).toBe("integration-test@example.com");
    });

    it("a row recorded on a stubbed non-production deployment is tagged is_test — same convention as recordBookingOutcome's", async () => {
      vi.stubEnv("VERCEL_ENV", "preview");
      await recordGuestReview({ companyId, rating: 4 });

      const { data, error } = await adminClient()
        .from("guest_reviews")
        .select("is_test")
        .eq("company_id", companyId)
        .gte("created_at", startedAt)
        .eq("rating", 4)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      expect(error).toBeNull();
      expect(data?.is_test).toBe(true);
    });
  });
});

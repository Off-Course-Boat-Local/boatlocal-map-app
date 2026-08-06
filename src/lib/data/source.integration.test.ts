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
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  getActiveCompanyRecord,
  getBoatTours,
  getCompanyBrand,
  getGuide,
  getMapPins,
  getPlaces,
  recordEvent,
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
    const { data, error } = await adminClient()
      .from("companies")
      .select("id")
      .eq("subdomain", "coastal")
      .single();
    if (error || !data) {
      throw new Error(
        `Seed company "coastal" not found in the real database (is it seeded? ` +
          `see supabase/seed.sql) — ${error?.message ?? "no row returned"}`,
      );
    }
    companyId = data.id as string;
  });

  it("getCompanyBrand: RPC company_by_subdomain returns the seeded brand", async () => {
    const brand = await getCompanyBrand("coastal");
    expect(brand).not.toBeNull();
    expect(brand?.appName).toBeTruthy();
    expect(brand?.primary).toMatch(/^#/);
  });

  // FIXED REAL BUG, originally caught by this integration test: per real
  // Postgres `language sql` function semantics, a function declared to
  // `returns` a single composite row still returns exactly one row — with
  // every column NULL — when its inner `select ... limit 1` matches zero
  // rows, rather than zero rows. public.company_by_subdomain() used to be
  // declared that way, so supabase-js's `.rpc()` handed source.ts a
  // non-null object of nulls for an unknown subdomain instead of `null`/no
  // rows. Fixed in supabase/migrations/20260805063612_helper_functions.sql
  // by dropping and recreating the function as `returns setof
  // public.companies` (create-or-replace can't change a function's return
  // type, hence the explicit drop) plus the corresponding array-unwrap in
  // getCompanyBrand's real branch. This assertion documents the contract
  // (`Brand | null`, matching the fakeStore branch and this function's own
  // return type) and now passes for real.
  it("getCompanyBrand: unknown subdomain returns null, not an error", async () => {
    const brand = await getCompanyBrand("does-not-exist-integration-check");
    expect(brand).toBeNull();
  });

  it("getActiveCompanyRecord: plain select returns the seeded active company", async () => {
    const record = await getActiveCompanyRecord("coastal");
    expect(record).not.toBeNull();
    expect(record?.subdomain).toBe("coastal");
    expect(record?.status).toBe("active");
    expect(record?.id).toBe(companyId);
  });

  it("getGuide: RPC guide_by_slug returns the seeded guide 'jan'", async () => {
    const guide = await getGuide(companyId, "jan");
    expect(guide).not.toBeNull();
    expect(guide?.slug).toBe("jan");
  });

  // Same class of bug as getCompanyBrand above, fixed the same way:
  // public.guide_by_slug() was also declared `returns public.guides`
  // (single composite row) instead of `setof`, so a zero-match lookup used
  // to come back as one all-NULL row instead of "no rows". Fixed alongside
  // company_by_subdomain() in
  // supabase/migrations/20260805063612_helper_functions.sql — see the
  // comment on the getCompanyBrand test above for the full explanation.
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
});

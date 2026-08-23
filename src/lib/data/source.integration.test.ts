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
});

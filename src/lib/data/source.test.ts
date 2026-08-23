import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BRANDS } from "../brand";
import { BOAT_TOURS, GUIDE, PLACES } from "../data";
import type { BoatLocalCruise } from "./types";
import { resetFakeStore } from "./fakeStore";
import {
  createCompany,
  deactivateBoatLocalCruise,
  deactivateGuide,
  deleteBoatTour,
  deleteCompany,
  deleteRecommendation,
  getActiveCompanyRecord,
  getBoatCatalogForStudio,
  getBoatTours,
  getCompanyAnalyticsSummary,
  getCompanyBrand,
  getCompanyRecord,
  getGuide,
  getGuideAnalyticsSummary,
  getGuidesForCompany,
  getMapPins,
  getPlaces,
  getPlatformAnalyticsSummary,
  findAttributedClick,
  getRecommendationsForStudio,
  inviteGuide,
  listBoatTourCatalog,
  listCompanies,
  reactivateGuide,
  reconcileBoatLocalCatalog,
  recordBookingOutcome,
  recordEvent,
  saveBoatTour,
  saveRecommendation,
  setBoatFeature,
  setBoatTourPosition,
  setCompanyStatus,
  setGuideStatus,
  syncCruiseFromBoatLocal,
  updateCompanyBranding,
  updateGuideProfile,
} from "./source";
import { StudioPermissionError } from "./types";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY_ID = "not-a-real-company";
const GUIDE_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_GUIDE_ID = "not-a-real-guide";

beforeEach(() => {
  resetFakeStore();
});

describe("guest reads (unauthenticated / anon-equivalent)", () => {
  it("resolves brand from the company id, matching src/lib/brand.ts", async () => {
    const brand = await getCompanyBrand(COMPANY_ID);
    expect(brand).not.toBeNull();
    expect(brand?.appName).toBe(BRANDS.coastal.appName);
    expect(brand?.primary).toBe(BRANDS.coastal.primary);
  });

  it("returns null for an unknown company id", async () => {
    expect(await getCompanyBrand("does-not-exist")).toBeNull();
  });

  it("resolves the guide by slug, matching src/lib/data.ts GUIDE", async () => {
    const guide = await getGuide(COMPANY_ID, GUIDE.slug);
    expect(guide).not.toBeNull();
    expect(guide?.name).toBe(GUIDE.name);
    expect(guide?.welcome).toBe(GUIDE.welcome);
  });

  it("returns null for a guide slug in the wrong company", async () => {
    expect(await getGuide(OTHER_COMPANY_ID, GUIDE.slug)).toBeNull();
  });

  it("returns all 14 seeded places, parity with src/lib/data.ts", async () => {
    const places = await getPlaces(COMPANY_ID);
    expect(places).toHaveLength(PLACES.length);
    const ids = new Set(places.map((p) => p.id));
    for (const p of PLACES) expect(ids.has(p.id)).toBe(true);
  });

  it("returns all 6 seeded, featured boat tours in position order", async () => {
    const tours = await getBoatTours(COMPANY_ID);
    expect(tours).toHaveLength(BOAT_TOURS.length);
    expect(tours.map((t) => t.position)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("orders by the tenant's own featured position, not the tour's global position, once reordered", async () => {
    const [first, second] = BOAT_TOURS;
    // Swap the two tenant-specific featured positions without touching the
    // tours' own global `position` field.
    await setBoatFeature({ role: "company", companyId: COMPANY_ID }, first.id, true, second.position);
    await setBoatFeature({ role: "company", companyId: COMPANY_ID }, second.id, true, first.position);

    const tours = await getBoatTours(COMPANY_ID);
    expect(tours[0].id).toBe(second.id);
    expect(tours[1].id).toBe(first.id);
  });

  it("carries no rating field anywhere in the guest-facing shapes", async () => {
    const [places, tours] = await Promise.all([getPlaces(COMPANY_ID), getBoatTours(COMPANY_ID)]);
    const serialised = JSON.stringify([places, tours]).toLowerCase();
    for (const banned of ["rating", "reviewcount", "stars"]) {
      expect(serialised).not.toContain(banned);
    }
  });

  it("puts boats first in the unified pin feed, never buried", async () => {
    const pins = await getMapPins(COMPANY_ID);
    expect(pins).toHaveLength(BOAT_TOURS.length + PLACES.length);
    expect(pins[0].isBoat).toBe(true);
    const firstPlaceIndex = pins.findIndex((p) => !p.isBoat);
    expect(firstPlaceIndex).toBe(BOAT_TOURS.length);
  });

  it("scopes reads to the requested tenant — an unknown company gets nothing", async () => {
    expect(await getPlaces(OTHER_COMPANY_ID)).toEqual([]);
    expect(await getBoatTours(OTHER_COMPANY_ID)).toEqual([]);
    expect(await getMapPins(OTHER_COMPANY_ID)).toEqual([]);
  });
});

describe("recordEvent", () => {
  it("accepts an anonymous, insert-only analytics event", async () => {
    await recordEvent({ eventType: "tip_viewed", companyId: COMPANY_ID, platform: "ios" });
    const summary = await getCompanyAnalyticsSummary({ role: "company", companyId: COMPANY_ID }, COMPANY_ID);
    expect(summary.find((r) => r.eventType === "tip_viewed")?.count).toBe(1);
  });
});

describe("findAttributedClick — the BoatLocal webhook's click lookup", () => {
  it("finds the boat_book_click event carrying this exact clickId", async () => {
    await recordEvent({
      eventType: "boat_book_click",
      companyId: COMPANY_ID,
      guideId: GUIDE_ID,
      boatTourId: "sunset-canal",
      metadata: { clickId: "bkl_abc" },
    });

    const click = await findAttributedClick("bkl_abc");
    expect(click).toEqual({ companyId: COMPANY_ID, guideId: GUIDE_ID, boatTourId: "sunset-canal" });
  });

  it("returns null for a clickId that was never recorded", async () => {
    expect(await findAttributedClick("bkl_never_happened")).toBeNull();
  });

  it("is not fooled by a different event type carrying the same-shaped metadata", async () => {
    await recordEvent({ eventType: "tip_viewed", metadata: { clickId: "bkl_wrong_type" } });
    expect(await findAttributedClick("bkl_wrong_type")).toBeNull();
  });
});

describe("recordBookingOutcome — the BoatLocal webhook's write side", () => {
  const CONFIRMED = {
    clickId: "bkl_xyz",
    bookingId: "BL-1",
    event: "booking.confirmed" as const,
    tourId: "sunset-canal",
    guests: 2,
    amountCents: 5600,
    currency: "EUR",
    bookedAt: "2026-08-20T18:00:00Z",
  };

  it("attributes a booking to the click's company/guide/tour and records it once", async () => {
    await recordEvent({
      eventType: "boat_book_click",
      companyId: COMPANY_ID,
      guideId: GUIDE_ID,
      boatTourId: "sunset-canal",
      metadata: { clickId: "bkl_xyz" },
    });

    const result = await recordBookingOutcome(CONFIRMED);
    expect(result).toEqual({ inserted: true, attributed: true });

    // Booking outcomes are admin-only (see the "booking_outcome is admin-only"
    // describe block below) — an admin actor is the only one who can still
    // see this count via getGuideAnalyticsSummary.
    const summary = await getGuideAnalyticsSummary({ role: "admin" }, GUIDE_ID);
    expect(summary.find((r) => r.eventType === "booking_outcome")?.count).toBe(1);
  });

  it("still records an unattributed booking (null company/guide) rather than dropping it", async () => {
    const result = await recordBookingOutcome({ ...CONFIRMED, clickId: "bkl_unknown" });
    expect(result).toEqual({ inserted: true, attributed: false });
  });

  it("is idempotent on (bookingId, event) — a retried delivery doesn't double-record", async () => {
    const first = await recordBookingOutcome(CONFIRMED);
    const second = await recordBookingOutcome(CONFIRMED);
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
  });

  it("still records a cancellation for a bookingId that was already confirmed, as its own event — not dropped as a duplicate", async () => {
    const confirmed = await recordBookingOutcome(CONFIRMED);
    expect(confirmed.inserted).toBe(true);

    const cancelled = await recordBookingOutcome({ ...CONFIRMED, event: "booking.cancelled" });
    // This is the exact bug decision 2 fixed: a bookingId-only dedup key
    // would have reported `inserted: false` here, silently dropping the
    // cancellation as if it were a retried delivery of the confirmation.
    expect(cancelled.inserted).toBe(true);
  });

  it("a retried cancellation still dedupes against itself, not against the earlier confirmation", async () => {
    await recordBookingOutcome(CONFIRMED);
    const first = await recordBookingOutcome({ ...CONFIRMED, event: "booking.cancelled" });
    const second = await recordBookingOutcome({ ...CONFIRMED, event: "booking.cancelled" });
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
  });

  it("a confirmed+cancelled pair for the same booking nets to zero in an admin-facing sum", async () => {
    await recordEvent({
      eventType: "boat_book_click",
      companyId: COMPANY_ID,
      guideId: GUIDE_ID,
      boatTourId: "sunset-canal",
      metadata: { clickId: "bkl_xyz" },
    });
    await recordBookingOutcome(CONFIRMED);
    await recordBookingOutcome({ ...CONFIRMED, event: "booking.cancelled" });

    const summary = await getGuideAnalyticsSummary({ role: "admin" }, GUIDE_ID);
    // No row at all (net zero), not a row with count 0 — the Map<> in the
    // fakeStore branch (and the real SQL's group-by) never creates an entry
    // whose count happens to sum to zero, it just nets within the one it
    // already has. Either way, summing it reads as zero.
    const bookingRow = summary.find((r) => r.eventType === "booking_outcome");
    expect(bookingRow?.count ?? 0).toBe(0);
  });

  describe("fallback attribution via echoed source_company/source_distributor", () => {
    it("attributes to the echoed company when the clickId doesn't resolve", async () => {
      const result = await recordBookingOutcome({
        ...CONFIRMED,
        clickId: "bkl_never_recorded",
        bookingId: "BL-fallback-1",
        sourceCompany: COMPANY_ID,
      });
      expect(result).toEqual({ inserted: true, attributed: true });

      const summary = await getCompanyAnalyticsSummary({ role: "admin" }, COMPANY_ID);
      expect(summary.find((r) => r.eventType === "booking_outcome")?.count).toBe(1);
    });

    it("also attributes the guide when source_distributor (a slug, not an id) resolves under that company", async () => {
      const result = await recordBookingOutcome({
        ...CONFIRMED,
        clickId: "bkl_never_recorded",
        bookingId: "BL-fallback-2",
        sourceCompany: COMPANY_ID,
        sourceDistributor: GUIDE.slug,
      });
      expect(result).toEqual({ inserted: true, attributed: true });

      const summary = await getGuideAnalyticsSummary({ role: "admin" }, GUIDE_ID);
      expect(summary.find((r) => r.eventType === "booking_outcome")?.count).toBe(1);
    });

    it("never trusts an echoed company id that doesn't resolve to a real company", async () => {
      const result = await recordBookingOutcome({
        ...CONFIRMED,
        clickId: "bkl_never_recorded",
        bookingId: "BL-fallback-3",
        sourceCompany: "not-a-real-company",
      });
      expect(result).toEqual({ inserted: true, attributed: false });
    });

    it("drops (not rejects) an echoed guide id that doesn't resolve under the echoed company, keeping company-level attribution", async () => {
      const result = await recordBookingOutcome({
        ...CONFIRMED,
        clickId: "bkl_never_recorded",
        bookingId: "BL-fallback-4",
        sourceCompany: COMPANY_ID,
        sourceDistributor: "not-a-real-guide",
      });
      // Still attributed (to the company) — a bad guide id doesn't sink the
      // whole fallback, per resolveFallbackAttribution's own doc comment.
      expect(result).toEqual({ inserted: true, attributed: true });

      const companySummary = await getCompanyAnalyticsSummary({ role: "admin" }, COMPANY_ID);
      expect(companySummary.find((r) => r.eventType === "booking_outcome")?.count).toBe(1);
    });

    it("does not consult fallback attribution at all when the clickId already resolved", async () => {
      await recordEvent({
        eventType: "boat_book_click",
        companyId: COMPANY_ID,
        guideId: GUIDE_ID,
        boatTourId: "sunset-canal",
        metadata: { clickId: "bkl_xyz" },
      });
      // sourceCompany intentionally points at a DIFFERENT (nonexistent)
      // company — if this were consulted, resolveFallbackAttribution
      // wouldn't even find it, but findAttributedClick should already have
      // succeeded first and short-circuited the fallback entirely.
      const result = await recordBookingOutcome({
        ...CONFIRMED,
        bookingId: "BL-fallback-5",
        sourceCompany: "not-a-real-company",
      });
      expect(result).toEqual({ inserted: true, attributed: true });
    });
  });
});

describe("booking_outcome is admin-only (RLS-mirroring exclusion in the fakeStore branch)", () => {
  beforeEach(async () => {
    await recordEvent({
      eventType: "boat_book_click",
      companyId: COMPANY_ID,
      guideId: GUIDE_ID,
      boatTourId: "sunset-canal",
      metadata: { clickId: "bkl_admin_only" },
    });
    await recordBookingOutcome({
      clickId: "bkl_admin_only",
      bookingId: "BL-admin-only-1",
      event: "booking.confirmed",
      tourId: "sunset-canal",
      guests: 2,
      amountCents: 5600,
      currency: "EUR",
      bookedAt: "2026-08-20T18:00:00Z",
    });
  });

  it("a company actor never sees a booking_outcome row for its own tenant", async () => {
    const rows = await getCompanyAnalyticsSummary({ role: "company", companyId: COMPANY_ID }, COMPANY_ID);
    expect(rows.some((r) => r.eventType === "booking_outcome")).toBe(false);
  });

  it("a guide actor never sees a booking_outcome row for their own scope", async () => {
    const rows = await getGuideAnalyticsSummary(
      { role: "guide", companyId: COMPANY_ID, guideId: GUIDE_ID },
      GUIDE_ID,
    );
    expect(rows.some((r) => r.eventType === "booking_outcome")).toBe(false);
  });

  it("an admin actor still sees it, via both functions", async () => {
    const companyRows = await getCompanyAnalyticsSummary({ role: "admin" }, COMPANY_ID);
    expect(companyRows.find((r) => r.eventType === "booking_outcome")?.count).toBe(1);

    const guideRows = await getGuideAnalyticsSummary({ role: "admin" }, GUIDE_ID);
    expect(guideRows.find((r) => r.eventType === "booking_outcome")?.count).toBe(1);
  });

  it("a company/guide actor still sees every other event type for their own scope", async () => {
    await recordEvent({ eventType: "tip_saved", companyId: COMPANY_ID, guideId: GUIDE_ID });
    const rows = await getCompanyAnalyticsSummary({ role: "company", companyId: COMPANY_ID }, COMPANY_ID);
    expect(rows.find((r) => r.eventType === "tip_saved")?.count).toBe(1);
  });
});

describe("BoatLocal cruise-catalogue sync", () => {
  const CRUISE: BoatLocalCruise = {
    id: 1,
    fareharborPk: 85146,
    slug: "shared-old-city-center-boat-tour",
    name: "Amsterdam Boat Tour of the Old City Center",
    cruiseType: "shared",
    cruiseDuration: "1 hour & 30 mins",
    startingPrice: 29,
    currency: "EUR",
    images: ["https://example.com/photo.jpg"],
    bookingUrl: "https://boatlocal.nl/cruise/shared-old-city-center-boat-tour",
    active: true,
    updatedAt: "2026-08-23T09:00:00Z",
    // Not live on BoatLocal's production feed as of this fixture — see
    // types.ts's BoatLocalCruise.departure doc comment. Individual tests
    // override this to exercise the departure-backfill behavior.
    departure: null,
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("syncCruiseFromBoatLocal", () => {
    it("inserts a brand-new cruise as hidden regardless of BoatLocal's own active flag, pending admin geo/description completion", async () => {
      const before = await listBoatTourCatalog(adminActor);
      await syncCruiseFromBoatLocal(CRUISE);
      const after = await listBoatTourCatalog(adminActor);

      expect(after).toHaveLength(before.length + 1);
      const created = after.find((t) => t.fareharborPk === 85146);
      expect(created).toBeTruthy();
      expect(created?.status).toBe("hidden");
      expect(created?.boatlocalActive).toBe(true);
      expect(created?.name).toBe(CRUISE.name);
      expect(created?.bookingUrl).toBe(CRUISE.bookingUrl);
      expect(created?.slug).toBe(CRUISE.slug);
      expect(created?.boatlocalId).toBe("1");
    });

    it("updates an already-known fareharbor_pk in place rather than creating a second row", async () => {
      await syncCruiseFromBoatLocal(CRUISE);
      await syncCruiseFromBoatLocal({ ...CRUISE, name: "Renamed Cruise", startingPrice: 35 });

      const after = await listBoatTourCatalog(adminActor);
      const matches = after.filter((t) => t.fareharborPk === 85146);
      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe("Renamed Cruise");
      expect(matches[0].meta).toContain("35");
    });

    it("keeps a brand-new row hidden on the very next sync even though BoatLocal still reports it active (the sticky safety-net gate)", async () => {
      await syncCruiseFromBoatLocal(CRUISE);
      // Simulates the very next scheduled reconciliation re-syncing the same
      // still-incomplete cruise — this must NOT flip it live, or the (0,0)
      // placeholder coordinates would put a real booking pin in the ocean.
      await syncCruiseFromBoatLocal({ ...CRUISE });

      const after = await listBoatTourCatalog(adminActor);
      const updated = after.find((t) => t.fareharborPk === 85146);
      expect(updated?.status).toBe("hidden");
      expect(updated?.area).toBe("");
    });

    it("drives status from BoatLocal's active flag once an admin has completed the tour's location/description", async () => {
      await syncCruiseFromBoatLocal(CRUISE);
      const created = (await listBoatTourCatalog(adminActor)).find((t) => t.fareharborPk === 85146)!;

      // Admin completes it via BoatTourForm — the only other status-setting
      // path — and marks it live.
      await saveBoatTour(adminActor, {
        id: created.id,
        name: created.name,
        area: "Centraal Station",
        lng: 4.9,
        lat: 52.38,
        meta: created.meta,
        note: "A guide's real description.",
        bookingUrl: created.bookingUrl,
        photos: created.photos,
        status: "active",
      });

      await syncCruiseFromBoatLocal({ ...CRUISE, active: false });
      const afterDeactivate = (await listBoatTourCatalog(adminActor)).find((t) => t.fareharborPk === 85146);
      expect(afterDeactivate?.status).toBe("hidden");
      expect(afterDeactivate?.boatlocalActive).toBe(false);

      await syncCruiseFromBoatLocal({ ...CRUISE, active: true });
      const afterReactivate = (await listBoatTourCatalog(adminActor)).find((t) => t.fareharborPk === 85146);
      expect(afterReactivate?.status).toBe("active");
    });

    it("never touches area/lng/lat/note/position once an admin has set them", async () => {
      await syncCruiseFromBoatLocal(CRUISE);
      const created = (await listBoatTourCatalog(adminActor)).find((t) => t.fareharborPk === 85146)!;

      await saveBoatTour(adminActor, {
        id: created.id,
        name: created.name,
        area: "Centraal Station",
        lng: 4.9,
        lat: 52.38,
        meta: created.meta,
        note: "A guide's real description.",
        bookingUrl: created.bookingUrl,
        photos: created.photos,
        status: "active",
      });

      await syncCruiseFromBoatLocal({ ...CRUISE, name: "Renamed Again" });

      const after = (await listBoatTourCatalog(adminActor)).find((t) => t.fareharborPk === 85146)!;
      expect(after.area).toBe("Centraal Station");
      expect(after.lng).toBe(4.9);
      expect(after.lat).toBe(52.38);
      expect(after.note).toBe("A guide's real description.");
    });

    describe("departure coordinates (BoatLocal's not-yet-live departure field)", () => {
      const CRUISE_WITH_DEPARTURE: BoatLocalCruise = {
        ...CRUISE,
        departure: {
          lat: 52.3651118,
          lng: 4.9034867,
          address: "Nieuwe Keizersgracht 1, 1018 DS Amsterdam",
          source: "google_maps_link",
        },
      };

      it("populates area/lng/lat/locationSource from departure on insert, but still stays hidden pending a note", async () => {
        await syncCruiseFromBoatLocal(CRUISE_WITH_DEPARTURE);
        const created = (await listBoatTourCatalog(adminActor)).find((t) => t.fareharborPk === 85146);

        expect(created?.area).toBe("Nieuwe Keizersgracht 1, 1018 DS Amsterdam");
        expect(created?.lng).toBe(4.9034867);
        expect(created?.lat).toBe(52.3651118);
        expect(created?.locationSource).toBe("google_maps_link");
        // The founder's explicit instruction: real departure data alone must
        // never auto-publish a cruise — a guide's own note is still required.
        expect(created?.note).toBe("");
        expect(created?.status).toBe("hidden");
      });

      it("leaves the old 0/0/\"\" placeholder when departure is null, exactly as before this field existed", async () => {
        await syncCruiseFromBoatLocal(CRUISE);
        const created = (await listBoatTourCatalog(adminActor)).find((t) => t.fareharborPk === 85146);

        expect(created?.area).toBe("");
        expect(created?.lng).toBe(0);
        expect(created?.lat).toBe(0);
        expect(created?.locationSource).toBeNull();
      });

      it("keeps a cruise with real departure data hidden across repeated syncs until an admin writes the note (gate is now keyed off note, not area)", async () => {
        await syncCruiseFromBoatLocal(CRUISE_WITH_DEPARTURE);
        // Simulates the next several scheduled reconciliations — area is
        // already real, so an area-based gate would have incorrectly treated
        // this as "complete" the moment it synced.
        await syncCruiseFromBoatLocal({ ...CRUISE_WITH_DEPARTURE, active: true });
        await syncCruiseFromBoatLocal({ ...CRUISE_WITH_DEPARTURE, active: true });

        const after = (await listBoatTourCatalog(adminActor)).find((t) => t.fareharborPk === 85146);
        expect(after?.status).toBe("hidden");
        expect(after?.area).toBe("Nieuwe Keizersgracht 1, 1018 DS Amsterdam");
      });

      it("backfills real coordinates on a later sync once departure becomes available for a cruise that synced before it existed", async () => {
        // First sync: BoatLocal's feed doesn't have departure data yet.
        await syncCruiseFromBoatLocal(CRUISE);
        const afterFirstSync = (await listBoatTourCatalog(adminActor)).find(
          (t) => t.fareharborPk === 85146,
        );
        expect(afterFirstSync?.area).toBe("");

        // BoatLocal ships departure data; the next reconciliation now
        // includes it for the same cruise.
        await syncCruiseFromBoatLocal(CRUISE_WITH_DEPARTURE);

        const after = (await listBoatTourCatalog(adminActor)).find((t) => t.fareharborPk === 85146);
        expect(after?.area).toBe("Nieuwe Keizersgracht 1, 1018 DS Amsterdam");
        expect(after?.lng).toBe(4.9034867);
        expect(after?.lat).toBe(52.3651118);
        expect(after?.locationSource).toBe("google_maps_link");
        // Still not published — no note yet.
        expect(after?.status).toBe("hidden");
      });

      it("never overwrites a real area once set — not an admin's manual entry, and not an earlier departure backfill", async () => {
        await syncCruiseFromBoatLocal(CRUISE_WITH_DEPARTURE);

        // BoatLocal later reports a different address for the same cruise
        // (e.g. a corrected Maps pin) — this must NOT silently move a real
        // "Book this tour" pin without an admin's own action.
        await syncCruiseFromBoatLocal({
          ...CRUISE_WITH_DEPARTURE,
          departure: {
            lat: 1,
            lng: 1,
            address: "A completely different address",
            source: "geocoded_address",
          },
        });

        const after = (await listBoatTourCatalog(adminActor)).find((t) => t.fareharborPk === 85146);
        expect(after?.area).toBe("Nieuwe Keizersgracht 1, 1018 DS Amsterdam");
        expect(after?.lng).toBe(4.9034867);
        expect(after?.lat).toBe(52.3651118);
        expect(after?.locationSource).toBe("google_maps_link");
      });
    });
  });

  describe("deactivateBoatLocalCruise", () => {
    it("hides the matching row and stores the reason as data", async () => {
      await syncCruiseFromBoatLocal(CRUISE);
      await deactivateBoatLocalCruise(
        { id: CRUISE.id, slug: CRUISE.slug, fareharborPk: CRUISE.fareharborPk },
        "removed_from_fareharbor",
      );

      const after = (await listBoatTourCatalog(adminActor)).find((t) => t.fareharborPk === 85146);
      expect(after?.status).toBe("hidden");
      expect(after?.deactivationReason).toBe("removed_from_fareharbor");
    });

    it("is a silent no-op for a cruise never synced, not an error", async () => {
      await expect(
        deactivateBoatLocalCruise({ id: 999, slug: null, fareharborPk: 99999 }, "admin_disabled"),
      ).resolves.toBeUndefined();
    });
  });

  describe("reconcileBoatLocalCatalog", () => {
    it("fetches, upserts every returned cruise, and hides BoatLocal-sourced rows no longer returned", async () => {
      await syncCruiseFromBoatLocal(CRUISE);
      const staleCruise: BoatLocalCruise = {
        ...CRUISE,
        id: 2,
        fareharborPk: 99999,
        slug: "some-other-cruise",
      };
      await syncCruiseFromBoatLocal(staleCruise);
      // Simulate an admin having already completed + published staleCruise —
      // a fresh, still-pending-completion row is already hidden, which would
      // make "reconciliation hid it" untestable (it never changes state).
      const staleRow = (await listBoatTourCatalog(adminActor)).find((t) => t.fareharborPk === 99999)!;
      await saveBoatTour(adminActor, {
        id: staleRow.id,
        name: staleRow.name,
        area: "Centraal Station",
        lng: 4.9,
        lat: 52.38,
        meta: staleRow.meta,
        note: "Real description.",
        bookingUrl: staleRow.bookingUrl,
        photos: staleRow.photos,
        status: "active",
      });

      // The re-fetch only returns CRUISE this time — staleCruise (99999) is
      // gone from the feed and must be hidden.
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({ cruises: [{ ...toWireCruise(CRUISE) }], generated_at: "now", count: 1 }),
        })),
      );

      const result = await reconcileBoatLocalCatalog();
      expect(result).toEqual({ fetched: 1, upserted: 1, deactivated: 1, error: undefined });

      const catalog = await listBoatTourCatalog(adminActor);
      expect(catalog.find((t) => t.fareharborPk === 99999)?.status).toBe("hidden");
      expect(catalog.find((t) => t.fareharborPk === 99999)?.deactivationReason).toBe(
        "removed_from_fareharbor",
      );
      expect(catalog.find((t) => t.fareharborPk === 85146)?.status).toBe("hidden"); // brand new via this test file, still pending admin completion
    });

    it("reports an error and leaves the catalog untouched on a non-2xx response", async () => {
      await syncCruiseFromBoatLocal(CRUISE);
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 })));

      const before = await listBoatTourCatalog(adminActor);
      const result = await reconcileBoatLocalCatalog();
      expect(result.error).toBeTruthy();
      expect(result.deactivated).toBe(0);

      const after = await listBoatTourCatalog(adminActor);
      expect(after).toEqual(before);
    });

    it("reports an error and skips deactivation entirely on a network failure, rather than throwing", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("network down");
        }),
      );
      await expect(reconcileBoatLocalCatalog()).resolves.toMatchObject({
        fetched: 0,
        upserted: 0,
        deactivated: 0,
      });
    });

    it("never mass-deactivates the catalog when the feed returns zero cruises", async () => {
      await syncCruiseFromBoatLocal(CRUISE);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true, json: async () => ({ cruises: [], generated_at: "now", count: 0 }) })),
      );

      const before = await listBoatTourCatalog(adminActor);
      const result = await reconcileBoatLocalCatalog();
      expect(result.error).toBeTruthy();
      expect(result.deactivated).toBe(0);

      const after = await listBoatTourCatalog(adminActor);
      expect(after).toEqual(before);
    });
  });
});

/** Turns a BoatLocalCruise back into the snake_case wire shape reconcileBoatLocalCatalog's fetch expects — the inverse of parseBoatLocalCruise, for building a fake `/api/public/cruises` response in tests. */
function toWireCruise(cruise: BoatLocalCruise) {
  return {
    id: cruise.id,
    fareharbor_pk: cruise.fareharborPk,
    slug: cruise.slug,
    name: cruise.name,
    cruise_type: cruise.cruiseType,
    cruise_duration: cruise.cruiseDuration,
    starting_price: cruise.startingPrice,
    currency: cruise.currency,
    images: cruise.images,
    booking_url: cruise.bookingUrl,
    active: cruise.active,
    updated_at: cruise.updatedAt,
  };
}

describe("Studio recommendation reads — mirrors RLS row visibility", () => {
  it("admin sees every recommendation", async () => {
    const rows = await getRecommendationsForStudio({ role: "admin" });
    expect(rows).toHaveLength(PLACES.length);
  });

  it("company sees its whole tenant: base list + every guide's items", async () => {
    const rows = await getRecommendationsForStudio({ role: "company", companyId: COMPANY_ID });
    expect(rows).toHaveLength(PLACES.length);
  });

  it("company scoped to another tenant sees nothing", async () => {
    const rows = await getRecommendationsForStudio({ role: "company", companyId: OTHER_COMPANY_ID });
    expect(rows).toHaveLength(0);
  });

  it("guide sees the base list read-only plus only their own items, never another guide's", async () => {
    const rows = await getRecommendationsForStudio({
      role: "guide",
      companyId: COMPANY_ID,
      guideId: GUIDE_ID,
    });
    // Every returned row is either the shared base list or this guide's own.
    for (const r of rows) {
      expect(r.ownerType === "company" || r.guideId === GUIDE_ID).toBe(true);
    }
    const otherGuideRows = rows.filter((r) => r.ownerType === "guide" && r.guideId !== GUIDE_ID);
    expect(otherGuideRows).toHaveLength(0);
  });

  it("a guide from a different company sees nothing from this tenant", async () => {
    const rows = await getRecommendationsForStudio({
      role: "guide",
      companyId: OTHER_COMPANY_ID,
      guideId: OTHER_GUIDE_ID,
    });
    expect(rows).toHaveLength(0);
  });
});

describe("Studio recommendation writes — mirrors RLS write policies", () => {
  const companyActor = { role: "company" as const, companyId: COMPANY_ID };
  const guideActor = { role: "guide" as const, companyId: COMPANY_ID, guideId: GUIDE_ID };
  const newInput = {
    category: "coffee" as const,
    name: "Test Cafe",
    area: "Centrum",
    address: "Teststraat 1",
    lng: 4.9,
    lat: 52.37,
    note: "Added by a test — this note is deliberately longer than a few words.",
    hours: "Daily 09:00-17:00",
    photos: ["https://example.com/a.jpg"],
  };

  it("company can create a base-list item", async () => {
    const rec = await saveRecommendation(companyActor, newInput);
    expect(rec.ownerType).toBe("company");
    expect(rec.guideId).toBeNull();
  });

  it("guide can create their own item", async () => {
    const rec = await saveRecommendation(guideActor, newInput);
    expect(rec.ownerType).toBe("guide");
    expect(rec.guideId).toBe(GUIDE_ID);
  });

  it("rejects a boat-category recommendation — boats are a separate table", async () => {
    await expect(
      saveRecommendation(companyActor, { ...newInput, category: "boats" as never }),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("admin may not directly own tenant recommendations via this path", async () => {
    await expect(saveRecommendation({ role: "admin" }, newInput)).rejects.toThrow(
      StudioPermissionError,
    );
  });

  it("company cannot edit a guide-owned item", async () => {
    const guideItem = (await getRecommendationsForStudio({ role: "admin" })).find(
      (r) => r.ownerType === "guide",
    )!;
    await expect(
      saveRecommendation(companyActor, { ...newInput, id: guideItem.id }),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("guide cannot edit a base-list item", async () => {
    const baseItem = (await getRecommendationsForStudio({ role: "admin" })).find(
      (r) => r.ownerType === "company",
    )!;
    await expect(saveRecommendation(guideActor, { ...newInput, id: baseItem.id })).rejects.toThrow(
      StudioPermissionError,
    );
  });

  it("guide cannot delete a base-list item, and it survives the attempt", async () => {
    const baseItem = (await getRecommendationsForStudio({ role: "admin" })).find(
      (r) => r.ownerType === "company",
    )!;
    await expect(deleteRecommendation(guideActor, baseItem.id)).rejects.toThrow(
      StudioPermissionError,
    );
    const stillThere = (await getRecommendationsForStudio({ role: "admin" })).find(
      (r) => r.id === baseItem.id,
    );
    expect(stillThere).toBeDefined();
  });

  it("guide can delete their own item", async () => {
    const own = (await getRecommendationsForStudio({ role: "admin" })).find(
      (r) => r.ownerType === "guide" && r.guideId === GUIDE_ID,
    )!;
    await deleteRecommendation(guideActor, own.id);
    const gone = (await getRecommendationsForStudio({ role: "admin" })).find(
      (r) => r.id === own.id,
    );
    expect(gone).toBeUndefined();
  });
});

describe("cross-tenant isolation", () => {
  it("no company can read another company's guides", async () => {
    await expect(
      getGuidesForCompany({ role: "company", companyId: COMPANY_ID }, OTHER_COMPANY_ID),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("no company can read another company's branding", async () => {
    await expect(
      updateCompanyBranding({ role: "company", companyId: COMPANY_ID }, OTHER_COMPANY_ID, {
        appName: "Hijacked",
      }),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("admin may read any company's guides", async () => {
    const guides = await getGuidesForCompany({ role: "admin" }, COMPANY_ID);
    expect(guides).toHaveLength(1);
    expect(guides[0].name).toBe(GUIDE.name);
  });
});

describe("boat tour featuring (company toggles, guide read-only)", () => {
  it("company can toggle a featured boat tour off", async () => {
    const [firstTour] = BOAT_TOURS;
    await setBoatFeature({ role: "company", companyId: COMPANY_ID }, firstTour.id, false);
    const catalog = await getBoatCatalogForStudio({ role: "company", companyId: COMPANY_ID });
    expect(catalog.find((t) => t.id === firstTour.id)?.isFeatured).toBe(false);
  });

  it("guide cannot toggle featuring", async () => {
    await expect(
      setBoatFeature(
        { role: "guide", companyId: COMPANY_ID, guideId: GUIDE_ID },
        BOAT_TOURS[0].id,
        false,
      ),
    ).rejects.toThrow(StudioPermissionError);
  });
});

describe("analytics rollups", () => {
  it("company sees its own guide's events; guide sees only their own", async () => {
    await recordEvent({ eventType: "directions_requested", companyId: COMPANY_ID, guideId: GUIDE_ID });
    await recordEvent({ eventType: "boat_book_click", companyId: COMPANY_ID, guideId: GUIDE_ID });

    const companyView = await getCompanyAnalyticsSummary(
      { role: "company", companyId: COMPANY_ID },
      COMPANY_ID,
    );
    expect(companyView.reduce((sum, r) => sum + r.count, 0)).toBe(2);

    const guideView = await getGuideAnalyticsSummary(
      { role: "guide", companyId: COMPANY_ID, guideId: GUIDE_ID },
      GUIDE_ID,
    );
    expect(guideView.reduce((sum, r) => sum + r.count, 0)).toBe(2);
  });

  it("a guide cannot read another guide's analytics", async () => {
    await expect(
      getGuideAnalyticsSummary(
        { role: "guide", companyId: COMPANY_ID, guideId: GUIDE_ID },
        OTHER_GUIDE_ID,
      ),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("only admin can read platform-wide analytics", async () => {
    await expect(
      getPlatformAnalyticsSummary({ role: "company", companyId: COMPANY_ID }),
    ).rejects.toThrow(StudioPermissionError);
    await expect(getPlatformAnalyticsSummary({ role: "admin" })).resolves.toBeDefined();
  });

  it("only admin can list every company", async () => {
    await expect(listCompanies({ role: "company", companyId: COMPANY_ID })).rejects.toThrow(
      StudioPermissionError,
    );
    const companies = await listCompanies({ role: "admin" });
    expect(companies).toHaveLength(1);
  });
});

describe("is_test tagging — non-production Vercel deployments never pollute real counts", () => {
  // VERCEL_ENV is never set for this suite (npx vitest run) — see
  // isNonProductionDeployment's own doc comment in src/lib/data/source.ts for
  // why that ambient absence must default to "not test" rather than "test":
  // every event this whole file records relies on that default to keep
  // counting normally. These tests are the ones that explicitly override it.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("recordEvent tags an event is_test when VERCEL_ENV is a non-production value", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await recordEvent({ eventType: "tip_saved", companyId: COMPANY_ID, guideId: GUIDE_ID });

    const rows = await getCompanyAnalyticsSummary(
      { role: "company", companyId: COMPANY_ID },
      COMPANY_ID,
    );
    expect(rows.find((r) => r.eventType === "tip_saved")).toBeUndefined();
  });

  it("recordBookingOutcome tags a booking is_test on a preview/staging deployment, excluded from admin-facing sums", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await recordEvent({
      eventType: "boat_book_click",
      companyId: COMPANY_ID,
      guideId: GUIDE_ID,
      metadata: { clickId: "bkl_preview_test" },
    });
    await recordBookingOutcome({
      clickId: "bkl_preview_test",
      bookingId: "PREVIEW-BOOKING-1",
      event: "booking.confirmed",
      tourId: "sunset-canal",
      guests: 2,
      amountCents: 5600,
      currency: "EUR",
      bookedAt: new Date().toISOString(),
    });

    const guideView = await getGuideAnalyticsSummary({ role: "admin" }, GUIDE_ID);
    expect(guideView.find((r) => r.eventType === "booking_outcome")).toBeUndefined();

    const platformView = await getPlatformAnalyticsSummary({ role: "admin" });
    expect(
      platformView.find((r) => r.companyId === COMPANY_ID && r.eventType === "booking_outcome"),
    ).toBeUndefined();
  });

  it("a real (production) deployment's booking still counts normally — the default this whole suite already relies on", async () => {
    // No stub at all — matches how every other test in this file records
    // events, proving the ambient VERCEL_ENV-unset default doesn't
    // accidentally tag real activity as test.
    await recordEvent({
      eventType: "boat_book_click",
      companyId: COMPANY_ID,
      guideId: GUIDE_ID,
      metadata: { clickId: "bkl_prod_test" },
    });
    await recordBookingOutcome({
      clickId: "bkl_prod_test",
      bookingId: "PROD-BOOKING-1",
      event: "booking.confirmed",
      tourId: "sunset-canal",
      guests: 2,
      amountCents: 5600,
      currency: "EUR",
      bookedAt: new Date().toISOString(),
    });

    const guideView = await getGuideAnalyticsSummary({ role: "admin" }, GUIDE_ID);
    expect(guideView.find((r) => r.eventType === "booking_outcome")?.count).toBe(1);
  });
});

// Booking-URL construction (buildBookingUrl, createClickId) is owned by
// src/lib/attribution.ts and already covered by src/lib/attribution.test.ts
// — it is deliberately not duplicated here. See the note at the top of
// src/lib/data/source.ts.

describe("inviteGuide", () => {
  const companyActor = { role: "company" as const, companyId: COMPANY_ID };

  it("creates an 'invited' guide with a fresh unique slug and a token", async () => {
    const guide = await inviteGuide(companyActor, COMPANY_ID, {
      name: "Maria",
      email: "maria@example.com",
    });
    expect(guide.status).toBe("invited");
    expect(guide.slug).toBe("maria");
    expect(guide.inviteToken).toBeTruthy();
    expect(guide.companyId).toBe(COMPANY_ID);

    const listed = await getGuidesForCompany(companyActor, COMPANY_ID);
    expect(listed.some((g) => g.id === guide.id)).toBe(true);
  });

  it("disambiguates a colliding slug within the same company", async () => {
    // GUIDE ("Jan") already occupies the "jan" slug in the seeded store.
    const guide = await inviteGuide(companyActor, COMPANY_ID, {
      name: "Jan",
      email: "jan2@example.com",
    });
    expect(guide.slug).toBe("jan-2");
  });

  it("a guide cannot invite another guide", async () => {
    await expect(
      inviteGuide(
        { role: "guide", companyId: COMPANY_ID, guideId: GUIDE_ID },
        COMPANY_ID,
        { name: "Maria", email: "maria@example.com" },
      ),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("no company can invite into another company's tenant", async () => {
    await expect(
      inviteGuide(companyActor, OTHER_COMPANY_ID, { name: "Maria", email: "maria@example.com" }),
    ).rejects.toThrow(StudioPermissionError);
  });
});

describe("setGuideStatus / deactivateGuide / reactivateGuide", () => {
  const companyActor = { role: "company" as const, companyId: COMPANY_ID };

  it("deactivates then reactivates a guide", async () => {
    await deactivateGuide(companyActor, GUIDE_ID);
    let guides = await getGuidesForCompany(companyActor, COMPANY_ID);
    expect(guides.find((g) => g.id === GUIDE_ID)?.status).toBe("deactivated");

    await reactivateGuide(companyActor, GUIDE_ID);
    guides = await getGuidesForCompany(companyActor, COMPANY_ID);
    expect(guides.find((g) => g.id === GUIDE_ID)?.status).toBe("active");
  });

  it("clears the invite token once a guide leaves 'invited'", async () => {
    const invited = await inviteGuide(companyActor, COMPANY_ID, {
      name: "Maria",
      email: "maria@example.com",
    });
    expect(invited.inviteToken).toBeTruthy();

    const activated = await setGuideStatus(companyActor, invited.id, "active");
    expect(activated.inviteToken).toBeNull();
  });

  it("a guide cannot deactivate anyone, including themself", async () => {
    await expect(
      deactivateGuide({ role: "guide", companyId: COMPANY_ID, guideId: GUIDE_ID }, GUIDE_ID),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("no company can change another company's guide", async () => {
    await expect(
      deactivateGuide({ role: "company", companyId: OTHER_COMPANY_ID }, GUIDE_ID),
    ).rejects.toThrow(StudioPermissionError);
  });
});

describe("updateGuideProfile", () => {
  it("a guide can update their own welcome message and photo", async () => {
    const guideActor = { role: "guide" as const, companyId: COMPANY_ID, guideId: GUIDE_ID };
    const updated = await updateGuideProfile(guideActor, GUIDE_ID, {
      welcomeMessage: "New welcome!",
      avatarUrl: "data:image/png;base64,abc",
    });
    expect(updated.welcomeMessage).toBe("New welcome!");
    expect(updated.avatarUrl).toBe("data:image/png;base64,abc");
  });

  it("a guide cannot edit another guide's profile", async () => {
    await expect(
      updateGuideProfile(
        { role: "guide", companyId: COMPANY_ID, guideId: OTHER_GUIDE_ID },
        GUIDE_ID,
        { welcomeMessage: "Hijacked" },
      ),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("a company cannot edit a guide's profile — it is the guide's own voice", async () => {
    await expect(
      updateGuideProfile({ role: "company", companyId: COMPANY_ID }, GUIDE_ID, {
        welcomeMessage: "Hijacked",
      }),
    ).rejects.toThrow(StudioPermissionError);
  });
});

describe("getCompanyRecord", () => {
  it("exposes the full row, including review URLs and campaign params", async () => {
    const company = await getCompanyRecord(COMPANY_ID);
    expect(company?.googleReviewUrl).toBeTruthy();
    expect(company?.campaignParams).toBeTruthy();
  });

  it("returns a deactivated company too — Studio needs to find it regardless of status", async () => {
    await setCompanyStatus({ role: "admin" }, COMPANY_ID, "suspended");
    expect((await getCompanyRecord(COMPANY_ID))?.status).toBe("suspended");
  });
});

describe("getActiveCompanyRecord (guest-facing gate on company status)", () => {
  // Regression: getGuide/getPlaces/getBoatTours/getMapPins take a companyId
  // and never re-check the parent company's own status — they trust whoever
  // resolved that companyId to have already gated on it. getCompanyRecord
  // used to be that resolver and did NOT check status, so deactivating a
  // company left its guide page, base-list recommendations, and featured
  // boat tours fully readable by anon. Mirrors the RLS fix in
  // supabase/migrations/20260805063611_rls_policies.sql's
  // private.company_is_active().
  it("returns the company when active", async () => {
    const company = await getActiveCompanyRecord(COMPANY_ID);
    expect(company?.id).toBe(COMPANY_ID);
  });

  it("returns null the moment the company is deactivated — same as nonexistent", async () => {
    expect((await getActiveCompanyRecord(COMPANY_ID))?.status).toBe("active");

    await setCompanyStatus({ role: "admin" }, COMPANY_ID, "suspended");

    expect(await getActiveCompanyRecord(COMPANY_ID)).toBeNull();
  });

  it("returns null for setup (pre-launch), not just suspended", async () => {
    await setCompanyStatus({ role: "admin" }, COMPANY_ID, "setup");
    expect(await getActiveCompanyRecord(COMPANY_ID)).toBeNull();
  });
});

const adminActor = { role: "admin" as const };
const newBoatTourInput = {
  name: "Midnight Lights Cruise",
  area: "Centraal",
  lng: 4.9,
  lat: 52.38,
  meta: "60 min · €30 pp",
  note: "A quiet, late one.",
  bookingUrl: "https://boatlocal.nl/tours/midnight-lights",
  photos: ["https://example.com/photo.jpg"],
};

describe("saveBoatTour", () => {
  it("admin can create a new boat tour, appended after the highest existing position", async () => {
    const before = await listBoatTourCatalog(adminActor);
    const maxPosition = before.reduce((max, t) => Math.max(max, t.position), 0);

    const created = await saveBoatTour(adminActor, newBoatTourInput);

    expect(created.id).toBeTruthy();
    expect(created.status).toBe("active");
    expect(created.position).toBe(maxPosition + 1);

    const after = await listBoatTourCatalog(adminActor);
    expect(after).toHaveLength(before.length + 1);
    expect(after.find((t) => t.id === created.id)?.name).toBe("Midnight Lights Cruise");
  });

  it("admin can edit an existing boat tour's fields", async () => {
    const [existing] = await listBoatTourCatalog(adminActor);
    const updated = await saveBoatTour(adminActor, {
      id: existing.id,
      name: "Renamed Tour",
      area: existing.area,
      lng: existing.lng,
      lat: existing.lat,
      meta: "120 min · €50 pp",
      note: "Updated description.",
      bookingUrl: existing.bookingUrl,
      photos: existing.photos,
      status: "hidden",
    });

    expect(updated.id).toBe(existing.id);
    expect(updated.name).toBe("Renamed Tour");
    expect(updated.meta).toBe("120 min · €50 pp");
    expect(updated.status).toBe("hidden");
  });

  it("editing without a position keeps the existing one", async () => {
    const [existing] = await listBoatTourCatalog(adminActor);
    const updated = await saveBoatTour(adminActor, { ...newBoatTourInput, id: existing.id });
    expect(updated.position).toBe(existing.position);
  });

  it("rejects a non-admin actor", async () => {
    await expect(
      saveBoatTour({ role: "company", companyId: COMPANY_ID }, newBoatTourInput),
    ).rejects.toThrow(StudioPermissionError);
    await expect(
      saveBoatTour(
        { role: "guide", companyId: COMPANY_ID, guideId: GUIDE_ID },
        newBoatTourInput,
      ),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("rejects editing an id that does not exist", async () => {
    await expect(
      saveBoatTour(adminActor, { ...newBoatTourInput, id: "not-a-real-tour" }),
    ).rejects.toThrow(StudioPermissionError);
  });
});

describe("deleteBoatTour", () => {
  it("admin can delete a boat tour, and it disappears from every company's featured list too", async () => {
    const [existing] = await listBoatTourCatalog(adminActor);
    const featuredBefore = await getBoatCatalogForStudio({ role: "company", companyId: COMPANY_ID });
    expect(featuredBefore.find((t) => t.id === existing.id)?.isFeatured).toBe(true);

    await deleteBoatTour(adminActor, existing.id);

    const after = await listBoatTourCatalog(adminActor);
    expect(after.find((t) => t.id === existing.id)).toBeUndefined();

    const featuredAfter = await getBoatCatalogForStudio({ role: "company", companyId: COMPANY_ID });
    expect(featuredAfter.find((t) => t.id === existing.id)).toBeUndefined();
  });

  it("rejects a non-admin actor", async () => {
    const [existing] = await listBoatTourCatalog(adminActor);
    await expect(
      deleteBoatTour({ role: "company", companyId: COMPANY_ID }, existing.id),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("deleting an id that does not exist is a no-op", async () => {
    await expect(deleteBoatTour(adminActor, "not-a-real-tour")).resolves.toBeUndefined();
  });
});

describe("setBoatTourPosition", () => {
  it("admin can set a tour's catalog-wide position directly", async () => {
    const [first, second] = await listBoatTourCatalog(adminActor);
    // listBoatTourCatalog's rows are the same object references the fake
    // store holds, so capture both positions up front — reading
    // `first.position` after the first call below would already observe
    // the mutation, since `first` and the store's row are one object.
    const firstId = first.id;
    const firstPosition = first.position;
    const secondId = second.id;
    const secondPosition = second.position;

    await setBoatTourPosition(adminActor, firstId, secondPosition);
    await setBoatTourPosition(adminActor, secondId, firstPosition);

    const reordered = await listBoatTourCatalog(adminActor);
    expect(reordered[0].id).toBe(secondId);
    expect(reordered[1].id).toBe(firstId);
  });

  it("rejects a non-admin actor", async () => {
    const [existing] = await listBoatTourCatalog(adminActor);
    await expect(
      setBoatTourPosition({ role: "company", companyId: COMPANY_ID }, existing.id, 99),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("rejects an id that does not exist", async () => {
    await expect(
      setBoatTourPosition(adminActor, "not-a-real-tour", 1),
    ).rejects.toThrow(StudioPermissionError);
  });
});

describe("createCompany", () => {
  const newCompanyInput = {
    name: "Amsterdam Adventures",
    companyType: "tour" as const,
    ownerEmail: "owner@amsterdamadventures.example",
  };

  it("admin can onboard a new company, defaulting to 'setup' status with an id assigned by the database", async () => {
    const company = await createCompany(adminActor, newCompanyInput);
    expect(company.id).toBeTruthy();
    expect(company.status).toBe("setup");
    expect(company.companyType).toBe("tour");

    const listed = await listCompanies(adminActor);
    expect(listed.some((c) => c.id === company.id)).toBe(true);
  });

  it("rejects a blank name", async () => {
    await expect(createCompany(adminActor, { ...newCompanyInput, name: "  " })).rejects.toThrow(
      /name is required/,
    );
  });

  it("rejects a blank owner email", async () => {
    await expect(
      createCompany(adminActor, { ...newCompanyInput, ownerEmail: "  " }),
    ).rejects.toThrow(/[Oo]wner email is required/);
  });

  it("sets ownerEmail and ownerStatus 'invited' on a newly onboarded company", async () => {
    const company = await createCompany(adminActor, newCompanyInput);
    expect(company.ownerEmail).toBe(newCompanyInput.ownerEmail);
    expect(company.ownerStatus).toBe("invited");
  });

  it("only admin may onboard a company", async () => {
    await expect(
      createCompany({ role: "company", companyId: COMPANY_ID }, newCompanyInput),
    ).rejects.toThrow(StudioPermissionError);
  });
});

describe("setCompanyStatus", () => {
  it("admin can flip a company from setup to active ('live')", async () => {
    const created = await createCompany(adminActor, {
      name: "New Tenant",
      companyType: "host",
      ownerEmail: "owner@newtenant.example",
    });
    expect(created.status).toBe("setup");

    const live = await setCompanyStatus(adminActor, created.id, "active");
    expect(live.status).toBe("active");
  });

  it("a company may not suspend itself (see src/lib/data/companyAdmin.test.ts for the full self-publish coverage)", async () => {
    await expect(
      setCompanyStatus({ role: "company", companyId: COMPANY_ID }, COMPANY_ID, "suspended"),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("rejects an id that does not exist", async () => {
    await expect(
      setCompanyStatus(adminActor, "not-a-real-company", "active"),
    ).rejects.toThrow(StudioPermissionError);
  });
});

describe("deleteCompany", () => {
  it("admin can delete a company, and it disappears from listCompanies", async () => {
    const created = await createCompany(adminActor, {
      name: "Disposable Co",
      companyType: "host",
      ownerEmail: "owner@disposable.example",
    });

    await deleteCompany(adminActor, created.id);

    const listed = await listCompanies(adminActor);
    expect(listed.some((c) => c.id === created.id)).toBe(false);
  });

  it("cascades to that company's guides and recommendations", async () => {
    const created = await createCompany(adminActor, {
      name: "Disposable Co 2",
      companyType: "host",
      ownerEmail: "owner@disposable2.example",
    });
    const guide = await inviteGuide(adminActor, created.id, {
      name: "Temp Guide",
      email: "temp-guide@disposable2.example",
    });

    await deleteCompany(adminActor, created.id);

    const guides = await getGuidesForCompany(adminActor, created.id);
    expect(guides.some((g) => g.id === guide.id)).toBe(false);
  });

  it("only admin may delete a company", async () => {
    await expect(
      deleteCompany({ role: "company", companyId: COMPANY_ID }, COMPANY_ID),
    ).rejects.toThrow(StudioPermissionError);
  });

  it("rejects an id that does not exist", async () => {
    await expect(deleteCompany(adminActor, "not-a-real-company")).rejects.toThrow(
      StudioPermissionError,
    );
  });
});

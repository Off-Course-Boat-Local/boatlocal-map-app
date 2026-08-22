import { beforeEach, describe, expect, it } from "vitest";

import { BRANDS } from "../brand";
import { BOAT_TOURS, GUIDE, PLACES } from "../data";
import { resetFakeStore } from "./fakeStore";
import {
  createCompany,
  deactivateGuide,
  deleteBoatTour,
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
  recordBookingOutcome,
  recordEvent,
  saveBoatTour,
  saveRecommendation,
  setBoatFeature,
  setBoatTourPosition,
  setCompanyStatus,
  setGuideStatus,
  updateCompanyBranding,
  updateGuideProfile,
} from "./source";
import { StudioPermissionError } from "./types";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY_ID = "not-a-real-company";
const GUIDE_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_GUIDE_ID = "not-a-real-guide";
const SUBDOMAIN = BRANDS.coastal.id;

beforeEach(() => {
  resetFakeStore();
});

describe("guest reads (unauthenticated / anon-equivalent)", () => {
  it("resolves brand from subdomain, matching src/lib/brand.ts", async () => {
    const brand = await getCompanyBrand(SUBDOMAIN);
    expect(brand).not.toBeNull();
    expect(brand?.appName).toBe(BRANDS.coastal.appName);
    expect(brand?.primary).toBe(BRANDS.coastal.primary);
  });

  it("returns null for an unknown subdomain", async () => {
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

    const summary = await getGuideAnalyticsSummary({ role: "guide", companyId: COMPANY_ID, guideId: GUIDE_ID }, GUIDE_ID);
    expect(summary.find((r) => r.eventType === "booking_outcome")?.count).toBe(1);
  });

  it("still records an unattributed booking (null company/guide) rather than dropping it", async () => {
    const result = await recordBookingOutcome({ ...CONFIRMED, clickId: "bkl_unknown" });
    expect(result).toEqual({ inserted: true, attributed: false });
  });

  it("is idempotent on bookingId — a retried delivery doesn't double-record", async () => {
    const first = await recordBookingOutcome(CONFIRMED);
    const second = await recordBookingOutcome(CONFIRMED);
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
  });
});

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
    const company = await getCompanyRecord(SUBDOMAIN);
    expect(company?.googleReviewUrl).toBeTruthy();
    expect(company?.campaignParams).toBeTruthy();
  });

  it("returns a deactivated company too — Studio needs to find it regardless of status", async () => {
    await setCompanyStatus({ role: "admin" }, COMPANY_ID, "suspended");
    expect((await getCompanyRecord(SUBDOMAIN))?.status).toBe("suspended");
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
    const company = await getActiveCompanyRecord(SUBDOMAIN);
    expect(company?.id).toBe(COMPANY_ID);
  });

  it("returns null the moment the company is deactivated — same as nonexistent", async () => {
    expect((await getActiveCompanyRecord(SUBDOMAIN))?.status).toBe("active");

    await setCompanyStatus({ role: "admin" }, COMPANY_ID, "suspended");

    expect(await getActiveCompanyRecord(SUBDOMAIN)).toBeNull();
  });

  it("returns null for setup (pre-launch), not just suspended", async () => {
    await setCompanyStatus({ role: "admin" }, COMPANY_ID, "setup");
    expect(await getActiveCompanyRecord(SUBDOMAIN)).toBeNull();
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

  it("admin can onboard a new company, defaulting to 'setup' status and a slugified subdomain", async () => {
    const company = await createCompany(adminActor, newCompanyInput);
    expect(company.subdomain).toBe("amsterdam-adventures");
    expect(company.status).toBe("setup");
    expect(company.companyType).toBe("tour");

    const listed = await listCompanies(adminActor);
    expect(listed.some((c) => c.id === company.id)).toBe(true);
  });

  it("slugifies a hand-typed subdomain the same way a guide slug is slugified", async () => {
    const company = await createCompany(adminActor, {
      ...newCompanyInput,
      subdomain: "Hotel V!",
    });
    expect(company.subdomain).toBe("hotel-v");
  });

  it("rejects a subdomain already taken by another company", async () => {
    await expect(
      createCompany(adminActor, { ...newCompanyInput, subdomain: SUBDOMAIN }),
    ).rejects.toThrow(/already in use/);
  });

  it("rejects a reserved subdomain (admin's own fixed hosts)", async () => {
    await expect(
      createCompany(adminActor, { ...newCompanyInput, subdomain: "admin" }),
    ).rejects.toThrow(/reserved/);
    await expect(
      createCompany(adminActor, { ...newCompanyInput, subdomain: "studio" }),
    ).rejects.toThrow(/reserved/);
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

  it("rejects a subdomain that exceeds the 63-char DNS label limit", async () => {
    // Regression: slugify() only filters characters, it does not enforce
    // length (see its own doc comment) — a long enough name used to sail
    // through createCompany with no isUrlSafeSubdomain check at all.
    const longName = "a".repeat(70);
    await expect(
      createCompany(adminActor, { ...newCompanyInput, name: longName }),
    ).rejects.toThrow(/not a valid subdomain/);
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

  it("only admin may change a company's status", async () => {
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

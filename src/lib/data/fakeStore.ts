// Boat Local Map App — fake in-memory backing store.
//
// TODO: replace with Supabase query once the project exists. Every table
// below is written to look exactly like the Postgres table it stands in for
// (see supabase/migrations/20260805063610_init_schema.sql), so swapping
// source.ts's implementations for real `supabase-js` calls later is a
// find-and-replace inside that one file, not a data-shape redesign.
//
// Seeded from src/lib/data.ts and src/lib/brand.ts so this module and
// supabase/seed.sql describe the same tenant: one company ("Boat & Bike
// Co.", matching BRANDS.coastal / DEFAULT_BRAND), one guide ("Jan"), 14
// recommendations, 6 boat tours, all featured.

import { BRANDS } from "../brand";
import { BOAT_TOURS, GUIDE, PLACES } from "../data";
import type {
  BoatTourRecord,
  CompanyBoatFeatureRecord,
  CompanyRecord,
  EventRecord,
  GuideRecord,
  RecommendationRecord,
} from "./types";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const GUIDE_ID = "22222222-2222-2222-2222-222222222222";
const now = () => new Date().toISOString();

// Guide's own personal picks, layered on top of the company base list — see
// supabase/seed.sql for why these particular ids were chosen (same split).
const GUIDE_OWNED_PLACE_IDS = new Set([
  "mook-pancakes",
  "pendergast",
  "screaming-beans",
  "anne-frank",
  "waterlooplein",
]);

function seedCompany(): CompanyRecord {
  const brand = BRANDS.coastal;
  const created = now();
  return {
    id: COMPANY_ID,
    name: brand.companyName,
    companyType: "host",
    appName: brand.appName,
    brandPrimary: brand.primary,
    brandPrimaryDark: brand.primaryDark,
    brandAccent: brand.accent,
    brandSurround: brand.surround,
    logoUrl: null,
    campaignParams: "utm_source=boatlocal&utm_medium=studio",
    googleReviewUrl: "https://g.page/r/example-boat-and-bike/review",
    tripadvisorReviewUrl: null,
    status: "active",
    // Seeded before the owner-invite feature existed — matches the "every
    // pre-existing row has no owner account" note on
    // supabase/migrations/20260807000000_company_owner_invite.sql.
    ownerEmail: null,
    ownerStatus: null,
    createdAt: created,
    updatedAt: created,
  };
}

function seedGuide(): GuideRecord {
  const created = now();
  return {
    id: GUIDE_ID,
    companyId: COMPANY_ID,
    name: GUIDE.name,
    email: "jan@example.com",
    slug: GUIDE.slug,
    avatarUrl: null,
    avatarInitial: GUIDE.avatarInitial,
    welcomeMessage: GUIDE.welcome,
    status: "active",
    inviteToken: null,
    createdAt: created,
    updatedAt: created,
  };
}

function seedRecommendations(): RecommendationRecord[] {
  const created = now();
  return PLACES.map((p) => {
    const isGuideOwned = GUIDE_OWNED_PLACE_IDS.has(p.id);
    return {
      id: p.id,
      companyId: COMPANY_ID,
      ownerType: isGuideOwned ? "guide" : "company",
      guideId: isGuideOwned ? GUIDE_ID : null,
      category: p.category,
      name: p.name,
      area: p.area,
      address: p.address,
      lng: p.lng,
      lat: p.lat,
      note: p.note,
      hours: p.hours,
      photos: [...p.photos],
      visible: true,
      createdBy: null,
      createdAt: created,
      updatedAt: created,
    };
  });
}

function seedBoatTours(): BoatTourRecord[] {
  const created = now();
  return BOAT_TOURS.map((b) => ({
    id: b.id,
    name: b.name,
    area: b.area,
    lng: b.lng,
    lat: b.lat,
    meta: b.meta,
    note: b.note,
    bookingUrl: b.bookingUrl,
    photos: [...b.photos],
    position: b.position,
    status: "active",
    createdAt: created,
    updatedAt: created,
    // Every seeded tour is admin-curated, never BoatLocal-sourced — see
    // BoatTourRecord's own doc comment for why every one of these is
    // nullable and null here specifically.
    boatlocalId: null,
    fareharborPk: null,
    slug: null,
    cruiseType: null,
    boatlocalActive: null,
    deactivationReason: null,
    boatlocalUpdatedAt: null,
    locationSource: null,
  }));
}

function seedCompanyBoatFeatures(): CompanyBoatFeatureRecord[] {
  const created = now();
  return BOAT_TOURS.map((b) => ({
    companyId: COMPANY_ID,
    boatTourId: b.id,
    isFeatured: true,
    position: b.position,
    createdAt: created,
  }));
}

/**
 * Mutable module-level store standing in for the database. Real callers
 * never reach in here directly — only src/lib/data/source.ts does, exactly
 * the way it would only ever hold a supabase-js client once one exists.
 */
export interface FakeStore {
  companies: CompanyRecord[];
  guides: GuideRecord[];
  recommendations: RecommendationRecord[];
  boatTours: BoatTourRecord[];
  companyBoatFeatures: CompanyBoatFeatureRecord[];
  events: EventRecord[];
  /**
   * Stands in for `companies.is_platform_default` (see
   * supabase/migrations/20260823190000_platform_default_company.sql) — kept
   * out of CompanyRecord on purpose (source.ts's getPlatformDefaultCompany/
   * setPlatformDefaultCompany are the only things that touch it), so it
   * lives here instead of on any one seeded company row. Null in a fresh
   * store, matching a real fresh install where no admin has configured one
   * yet.
   */
  platformDefaultCompanyId: string | null;
}

function seedStore(): FakeStore {
  return {
    companies: [seedCompany()],
    guides: [seedGuide()],
    recommendations: seedRecommendations(),
    boatTours: seedBoatTours(),
    companyBoatFeatures: seedCompanyBoatFeatures(),
    events: [],
    platformDefaultCompanyId: null,
  };
}

export const fakeStore: FakeStore = seedStore();

/** Test-only: restores the store to its seeded state between test cases. */
export function resetFakeStore(): void {
  const fresh = seedStore();
  fakeStore.companies = fresh.companies;
  fakeStore.guides = fresh.guides;
  fakeStore.recommendations = fresh.recommendations;
  fakeStore.boatTours = fresh.boatTours;
  fakeStore.companyBoatFeatures = fresh.companyBoatFeatures;
  fakeStore.events = fresh.events;
  fakeStore.platformDefaultCompanyId = fresh.platformDefaultCompanyId;
}

let idCounter = 0;
/** Stand-in for `gen_random_uuid()`. Deterministic, not cryptographically anything — test/dev only. */
export function fakeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

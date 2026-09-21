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
  CompanyEventRecord,
  CompanyRecord,
  EventRecord,
  GuestReviewRecord,
  GuideRecord,
  RecommendationRecord,
  RouteRecord,
  RouteStopRecord,
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
    reviewPlatform: "google",
    customDomain: null,
    status: "active",
    ownerEmail: null,
    ownerStatus: null,
    modules: { routes: true, events: true, custom_tours: true },
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
      categories: p.categories,
      name: p.name,
      area: p.area,
      address: p.address,
      lng: p.lng,
      lat: p.lat,
      note: p.note,
      hours: p.hours,
      photos: [...p.photos],
      visible: true,
      googleRating: p.googleRating,
      googleReviewCount: p.googleReviewCount,
      cuisineTypes: p.cuisineTypes ?? [],
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
    boatlocalHeadline: null,
    locationSource: null,
    cruiseDuration: null,
    startingPriceCents: null,
    priceCurrency: null,
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

function seedRoutes(): RouteRecord[] {
  const created = now();
  return [
    {
      id: "route-jordaan-bike",
      companyId: COMPANY_ID,
      title: "Jordaan Historic Bike Loop",
      slug: "jordaan-historic-bike-loop",
      transportMode: "bike",
      summary: "A scenic 45-minute cycling loop through Amsterdam's prettiest canal bridges and hidden Jordaan spots.",
      description: "Start at Café Papeneiland for an apple pie espresso, ride down Prinsengracht past Anne Frank House, through the 9 Streets, and finish with lunch at Foodhallen.",
      durationMinutes: 45,
      distanceMeters: 5200,
      polyline: null,
      photos: ["https://picsum.photos/seed/bike1/800/600", "https://picsum.photos/seed/bike2/800/600"],
      position: 1,
      isPublished: true,
      createdAt: created,
      updatedAt: created,
    },
  ];
}

function seedRouteStops(): RouteStopRecord[] {
  const created = now();
  return [
    {
      id: "stop-1",
      routeId: "route-jordaan-bike",
      recommendationId: "cafe-papeneiland",
      title: "Café Papeneiland",
      description: "Grab a morning coffee & traditional Dutch apple pie before pedalling.",
      lng: 4.8846,
      lat: 52.3799,
      address: "Prinsengracht 2",
      photos: ["https://picsum.photos/seed/papen0/800/600"],
      stopOrder: 1,
      createdAt: created,
    },
    {
      id: "stop-2",
      routeId: "route-jordaan-bike",
      recommendationId: "anne-frank",
      title: "Westerkerk & Anne Frank",
      description: "Scenic pause at the Westerkerk bell tower.",
      lng: 4.884,
      lat: 52.3752,
      address: "Westermarkt 20",
      photos: ["https://picsum.photos/seed/anne0/800/600"],
      stopOrder: 2,
      createdAt: created,
    },
    {
      id: "stop-3",
      routeId: "route-jordaan-bike",
      recommendationId: "nine-streets",
      title: "De 9 Straatjes (Nine Streets)",
      description: "Boutique shopping and picturesque canal bridges.",
      lng: 4.8846,
      lat: 52.3712,
      address: "Reestraat / Hartenstraat",
      photos: ["https://picsum.photos/seed/negen0/800/600"],
      stopOrder: 3,
      createdAt: created,
    },
    {
      id: "stop-4",
      routeId: "route-jordaan-bike",
      recommendationId: "foodhallen",
      title: "Foodhallen Oud-West",
      description: "End the tour with delicious street food inside an old tram depot.",
      lng: 4.869,
      lat: 52.3661,
      address: "Bellamyplein 51",
      photos: ["https://picsum.photos/seed/foodhal0/800/600"],
      stopOrder: 4,
      createdAt: created,
    },
  ];
}

function seedCompanyEvents(): CompanyEventRecord[] {
  const created = now();
  const nextFriday = new Date();
  nextFriday.setDate(nextFriday.getDate() + ((5 + 7 - nextFriday.getDay()) % 7 || 7));
  nextFriday.setHours(18, 30, 0, 0);

  return [
    {
      id: "event-sunset-social",
      companyId: COMPANY_ID,
      title: "Friday Canal Sunset Social",
      description: "Join fellow travellers and locals for a golden-hour drink and casual boat chat along the Prinsengracht.",
      startTime: nextFriday.toISOString(),
      endTime: new Date(nextFriday.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      venueName: "Prinsengracht Canal Dock",
      address: "Prinsengracht 2, Amsterdam",
      lng: 4.8846,
      lat: 52.3799,
      photos: ["https://picsum.photos/seed/eventsocial/800/600"],
      ticketUrl: "https://boatlocal.nl",
      priceLabel: "Free RSVP",
      isPublished: true,
      createdAt: created,
      updatedAt: created,
    },
  ];
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
  companyEvents: CompanyEventRecord[];
  routes: RouteRecord[];
  routeStops: RouteStopRecord[];
  /** Backs recordGuestReview — see supabase/migrations/20260824000000_guest_reviews.sql. */
  guestReviews: GuestReviewRecord[];
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
    companyEvents: seedCompanyEvents(),
    routes: seedRoutes(),
    routeStops: seedRouteStops(),
    guestReviews: [],
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
  fakeStore.companyEvents = fresh.companyEvents;
  fakeStore.routes = fresh.routes;
  fakeStore.routeStops = fresh.routeStops;
  fakeStore.guestReviews = fresh.guestReviews;
  fakeStore.platformDefaultCompanyId = fresh.platformDefaultCompanyId;
}

let idCounter = 0;
/** Stand-in for `gen_random_uuid()`. Deterministic, not cryptographically anything — test/dev only. */
export function fakeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

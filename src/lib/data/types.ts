// Boat Local Map App — data-access layer types.
//
// These mirror the columns in supabase/migrations/20260805063610_init_schema.sql
// 1:1. They are deliberately separate from src/lib/types.ts, which stays the
// lightweight *guest-rendering* shape (Brand, Place, BoatTour, Guide, MapPin)
// that the map components already depend on. The mapping between the two
// lives in this module (see e.g. recommendationToPlace) so that when a real
// Supabase project exists, only the row-fetching functions below change —
// no component prop shape does.
//
// NOTE: no rating/review_count/stars field appears anywhere in here, on
// purpose and permanently — see CLAUDE project rules.

import type { CategoryId } from "../types";

export type AppRole = "admin" | "company" | "guide";
// Free text, admin-entered, optional ("Hotel", "Shop", "Bar", ...) — see
// supabase/migrations/20260823150000_company_type_free_text_and_self_publish.sql
// for why this stopped being a fixed enum: it has never driven any
// behaviour in the app, only ever been displayed, so a closed vocabulary
// was friction with no payoff.
export type CompanyType = string;
// "setup" is an addition on top of the schema handed off from the schema
// agent (whose migration only allowed 'active' | 'suspended' — see
// supabase/migrations/20260805063610_init_schema.sql). Admin's onboarding
// flow (PRD §8.3: "create/onboard a company") needs a third state to
// distinguish "row exists, being configured, not shown to guests yet" from
// "live" (PRD §2.3's "setup vs live status"), so the check constraint gains
// that one value too (same migration file, same comment) — mirroring
// exactly how GuideStatus's "invited" value was added below. Nothing else
// about the table shape changes. "active" is what PRD prose calls "live";
// no separate DB value is needed for that since it's just the pre-existing
// default.
export type CompanyStatus = "setup" | "active" | "suspended";
// "invited" is an addition on top of the schema handed off from the schema
// agent (whose migration only allowed 'active' | 'deactivated' — see
// supabase/migrations/20260805063610_init_schema.sql). The Studio "Guides"
// invite flow (PRD §7.3) needs a third state to distinguish "link generated,
// not yet signed up" from "signed up and using the app", so the check
// constraint gains that one value too (same migration file, same comment).
// Nothing else about the table shape changes.
export type GuideStatus = "invited" | "active" | "deactivated";
export type RecommendationOwnerType = "company" | "guide";
export type BoatTourStatus = "active" | "hidden";
export type EventPlatform = "ios" | "android" | "desktop" | "unknown";

export type EventType =
  | "app_open"
  | "app_install"
  | "tip_viewed"
  | "tip_saved"
  | "tip_unsaved"
  | "directions_requested"
  | "boat_book_click"
  | "review_click_google"
  | "review_click_tripadvisor"
  | "review_private_feedback"
  | "booking_outcome";

export interface CompanyRecord {
  id: string;
  name: string;
  companyType: CompanyType | null;
  appName: string;
  brandPrimary: string;
  brandPrimaryDark: string;
  brandAccent: string;
  brandSurround: string;
  logoUrl: string | null;
  /** Raw query-string fragment (no leading ?/&), merged into every booking URL by src/lib/attribution.ts buildBookingUrl(). */
  campaignParams: string | null;
  googleReviewUrl: string | null;
  tripadvisorReviewUrl: string | null;
  status: CompanyStatus;
  /** The company's first Studio user (role=company). Null for rows created before this existed. */
  ownerEmail: string | null;
  /**
   * 'invited' until redeemed at /join/[token], 'active' once claimed. Null
   * means no owner invite has ever been issued — distinct from 'invited',
   * never treat null as "pending". Deliberately NOT ownerInviteToken here —
   * that value is never exposed through this general-purpose type; see
   * fromCompanyRow's comment in src/lib/data/source.ts for why.
   */
  ownerStatus: "invited" | "active" | null;
  createdAt: string;
  updatedAt: string;
}

export interface GuideRecord {
  id: string;
  companyId: string;
  name: string;
  email: string;
  slug: string;
  avatarUrl: string | null;
  avatarInitial: string;
  welcomeMessage: string;
  status: GuideStatus;
  /**
   * The token embedded in the invite link Studio hands the company (PRD
   * §7.3). Set at invite time, cleared once the guide's status leaves
   * "invited". There is no real backend yet to redeem it against (see
   * src/app/studio/join/[token]/page.tsx's own comment) — it exists purely
   * so the generated URL is a real, unique, unguessable-enough value rather
   * than a placeholder string.
   */
  inviteToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationRecord {
  id: string;
  companyId: string;
  ownerType: RecommendationOwnerType;
  /** Set iff ownerType === "guide". */
  guideId: string | null;
  category: CategoryId;
  name: string;
  area: string;
  address: string;
  lng: number;
  lat: number;
  /** The guide's personal endorsement. This is the trust signal — never a rating. */
  note: string;
  /** Guide-entered free text, e.g. "Tue–Sun 11:00–18:00, closed Mondays". */
  hours: string;
  photos: string[];
  visible: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoatTourRecord {
  id: string;
  name: string;
  area: string;
  lng: number;
  lat: number;
  meta: string;
  note: string;
  bookingUrl: string;
  photos: string[];
  position: number;
  status: BoatTourStatus;
  createdAt: string;
  updatedAt: string;
  /**
   * BoatLocal catalogue identity/lifecycle fields (docs/attribution.md's
   * "cruise catalogue sync" section) — all null for an admin-curated tour
   * that was never synced from BoatLocal, which is every tour that existed
   * before this feature and remains a fully supported way to add one.
   * boatlocalId is BoatLocal's internal PK, reference/dedup only — NEVER
   * used to build a URL (it always 404s on their side); bookingUrl above is
   * the only routable link. See syncCruiseFromBoatLocal in
   * src/lib/data/source.ts for how these get populated.
   */
  boatlocalId: string | null;
  fareharborPk: number | null;
  slug: string | null;
  cruiseType: string | null;
  /**
   * BoatLocal's own raw active flag, kept distinct from `status` above — see
   * this table's own migration comment (20260823200000_boatlocal_catalog_sync.sql)
   * for exactly how the two relate.
   */
  boatlocalActive: boolean | null;
  /**
   * From a `cruise.deactivated` webhook's `reason` field, or inferred as
   * "removed_from_fareharbor" by a reconciliation pass. Stored as data only
   * — whether Map App should ever behave differently based on this value is
   * an explicitly open question; see docs/attribution.md.
   */
  deactivationReason: string | null;
  /** The catalogue/webhook payload's own `updated_at` for this cruise. */
  boatlocalUpdatedAt: string | null;
  /**
   * Which BoatLocal `departure.source` value (if any) the current area/lng/
   * lat came from, e.g. so Admin could eventually show a confidence hint
   * ("geocoded" vs. "pinned on Maps") — no UI built for that yet, but kept
   * queryable from day one so that's a read of existing data later, not a
   * backfill (same rationale as boatlocalUpdatedAt above). Null for an
   * admin-curated tour, and for a BoatLocal-sourced one where neither
   * BoatLocal's `departure` nor an admin has ever supplied a location yet.
   * See syncCruiseFromBoatLocal in src/lib/data/source.ts for exactly when
   * this gets set (once, same moment area/lng/lat are first backfilled from
   * `departure` — never touched again after that, same as those fields).
   */
  locationSource: string | null;
}

/**
 * BoatLocal's per-cruise departure-point data (added to their catalogue feed
 * after the rest of this integration — see docs/attribution.md). `source` is
 * `"google_maps_link"` (an operator-pinned Maps link — high confidence) or
 * `"geocoded_address"` (geocoded from free text — slightly lower confidence,
 * still real, still per-cruise). Kept as a plain nullable string rather than
 * a union, matching this file's existing `deactivationReason`/`reason`
 * convention for an open-ended, partner-supplied value Map App doesn't
 * branch behavior on today (see parseBoatLocalCruise's own doc comment for
 * why "unknown value" must never be treated the same as "no departure data
 * at all" — the two mean very different things here).
 */
export interface BoatLocalCruiseDeparture {
  lat: number;
  lng: number;
  address: string;
  source: string | null;
}

/**
 * One entry from BoatLocal's public catalogue feed
 * (`GET /api/public/cruises`) or a `cruise.activated` webhook's `cruise`
 * field — same shape either way, per BoatLocal's confirmed contract (see
 * docs/attribution.md). Field names are already camelCased here;
 * src/lib/boatlocalCatalog.ts's parseBoatLocalCruise does the snake_case ->
 * camelCase mapping from the wire payload, the same split attribution.ts /
 * attributionWebhook.ts already use for the booking webhook.
 */
export interface BoatLocalCruise {
  id: number;
  fareharborPk: number | null;
  slug: string | null;
  name: string;
  cruiseType: string | null;
  cruiseDuration: string | null;
  startingPrice: number | null;
  currency: string | null;
  images: string[];
  bookingUrl: string;
  active: boolean;
  updatedAt: string | null;
  /**
   * Real per-cruise departure coordinates — `null` for the small subset of
   * cruises (seasonal/candlelight, ~4 of 61 as of this field shipping) with
   * neither a Google Maps link nor an address on BoatLocal's side, and
   * always `null` today since BoatLocal hasn't shipped this field to
   * production yet (confirmed shipping to their staging first — see
   * docs/attribution.md). Never geocoded or defaulted on Map App's own side
   * either way — see syncCruiseFromBoatLocal's doc comment in
   * src/lib/data/source.ts.
   */
  departure: BoatLocalCruiseDeparture | null;
}

export interface CompanyBoatFeatureRecord {
  companyId: string;
  boatTourId: string;
  isFeatured: boolean;
  position: number;
  createdAt: string;
}

export interface EventRecord {
  id: string;
  eventType: EventType;
  companyId: string | null;
  guideId: string | null;
  boatTourId: string | null;
  recommendationId: string | null;
  guestSessionId: string | null;
  platform: EventPlatform;
  metadata: Record<string, unknown>;
  occurredAt: string;
  /**
   * True when this event was recorded from a non-production Vercel
   * deployment (see isNonProductionDeployment in src/lib/data/source.ts) —
   * the replacement for manually spotting TEST-/E2E-/STG- booking_id or
   * bkl_TEST_/bkl_E2E_/bkl_STG_ click_id prefixes left behind by BoatLocal's
   * own testing (docs/attribution.md). Always server-derived, never settable
   * by NewEventInput's caller. Every analytics rollup in this file excludes
   * isTest=true rows by default, mirroring
   * supabase/migrations/20260823240000_events_is_test_tag.sql's matching
   * `is_test` column and RPC exclusion.
   */
  isTest: boolean;
}

/**
 * The caller's identity for Studio/Admin reads and writes.
 *
 * Derived server-side from the real Supabase Auth session (`auth.uid()` ->
 * `profiles` row) — see src/lib/studio/devAuth.ts and src/lib/admin/devAuth.ts
 * for how a session resolves to one of these. Every data-access function
 * that touches tenant- or guide-scoped data takes an actor and enforces the
 * same rules as the RLS policies in
 * supabase/migrations/20260805063611_rls_policies.sql, so the fake store
 * behaves like the real database will.
 */
export type StudioActor =
  | { role: "admin" }
  | { role: "company"; companyId: string }
  | { role: "guide"; companyId: string; guideId: string };

/** Thrown by write operations the actor is not allowed to perform. Mirrors what a denied RLS write would do (0 rows affected). */
export class StudioPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudioPermissionError";
  }
}

export interface SaveRecommendationInput {
  id?: string;
  category: CategoryId;
  name: string;
  area: string;
  address: string;
  lng: number;
  lat: number;
  note: string;
  hours: string;
  photos: string[];
  visible?: boolean;
}

export interface SaveBoatTourInput {
  id?: string;
  name: string;
  area: string;
  lng: number;
  lat: number;
  meta: string;
  note: string;
  bookingUrl: string;
  photos: string[];
  position?: number;
  status?: BoatTourStatus;
}

export interface InviteGuideInput {
  name: string;
  email: string;
}

/**
 * Admin's "create/onboard a company" flow (PRD §8.3). There is no subdomain
 * (or any other identifier) for an admin to type any more — a company's id,
 * assigned by the database default, is the only identifier guest links ever
 * need (see src/lib/guestBrand.ts's `?company=<id>` scheme). Always starts
 * "setup" (PRD §2.3) — Admin no longer picks an initial status; the company
 * itself flips it live from Studio once it's ready (setCompanyStatus now
 * allows that self-service toggle, see its own doc comment).
 *
 * No brand colours are asked for here on purpose: PRD §7.2's colour picker
 * is a Studio-side, company-editable concern, not part of Admin onboarding.
 * A new company starts with a neutral placeholder brand (see
 * ONBOARDING_DEFAULT_BRAND in source.ts) until the company customises it.
 */
export interface CreateCompanyInput {
  name: string;
  /** Free text, optional — e.g. "Hotel", "Shop", "Bar". Purely descriptive. */
  companyType?: string;
  /**
   * Required, not optional — mirrors PRD §6.1's guide invite exactly: this
   * is who signs in to manage the company in Studio, not a general contact
   * address. createCompany() generates a real invite token for it, same as
   * inviteGuide() does; there is no path to onboard a company without
   * establishing who its first user is.
   */
  ownerEmail: string;
}

export interface UpdateGuideProfileInput {
  avatarUrl?: string | null;
  welcomeMessage?: string;
}

export interface AnalyticsSummaryRow {
  eventType: EventType;
  guideId: string | null;
  count: number;
}

export interface AnalyticsRange {
  from: Date;
  to: Date;
}

export interface NewEventInput {
  eventType: EventType;
  companyId?: string | null;
  guideId?: string | null;
  boatTourId?: string | null;
  recommendationId?: string | null;
  guestSessionId?: string | null;
  platform?: EventPlatform;
  metadata?: Record<string, unknown>;
}

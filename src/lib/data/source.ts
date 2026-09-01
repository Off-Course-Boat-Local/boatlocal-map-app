// Boat Local Map App — typed data-access interface.
//
// Every screen (guest app, Studio, Admin) should import from *this file*,
// never from src/lib/data/fakeStore.ts and never from a Supabase client
// directly. That is the whole point of a DataSource-style interface.
//
// This module is now backed by the real Supabase project (see
// supabase/migrations/*.sql) for real usage, via:
//   - an `anon` client (no session) for guest-facing reads/writes, matching
//     Postgres role `anon`;
//   - the request-scoped `authed` client (src/lib/supabase/server.ts — anon
//     key + the signed-in user's session cookies) for Studio/Admin
//     reads/writes, matching Postgres role `authenticated`. This is what
//     RLS's private.current_role_name()/current_company_id()/
//     current_guide_id()/is_admin() resolve against via auth.uid().
// None of the 31 functions below need the service-role (`admin`) client —
// see supabase/migrations + the mapping this file was built from: RLS plus
// an authenticated session covers every one of them, including admin's own
// cross-tenant reads (admin_full_access already grants that to an admin's
// own authenticated session). src/lib/supabase/admin.ts is reserved for the
// three auth-bootstrap flows that live outside this file entirely (guide
// invite-token redemption, admin allowlist bootstrap, company first-sign-in
// bootstrap).
//
// TEST-ENVIRONMENT BRANCH — READ THIS BEFORE "SIMPLIFYING":
// src/lib/data/source.test.ts (708 lines) exercises these functions directly
// against src/lib/data/fakeStore.ts and is required to keep passing exactly
// as-is (see this task's own instructions — intentional, not a gap to close).
// That is only possible because every function below checks `isTestEnv` and
// takes the original fakeStore-backed path when true. This is not optional
// scaffolding to remove once "real" Supabase is wired up — it is load-bearing
// for two independent, verified technical reasons:
//   1. src/lib/supabase/server.ts imports `next/headers`'s `cookies()`, which
//      throws outside a real Next.js request context (Vitest's environment
//      is plain jsdom/Node, not a Next.js request).
//   2. src/lib/supabase/server.ts and admin.ts both start with
//      `import "server-only"`, whose *default* export condition throws
//      unconditionally on import (verified empirically: a plain Vitest import
//      of src/lib/supabase/admin.ts throws
//      "This module cannot be imported from a Client Component module" even
//      though nothing here is a Client Component — Node/Vitest doesn't apply
//      Next's bundler-only "react-server" condition that makes the package's
//      no-op branch resolve instead).
// Because of #2, `authedClient()` below deliberately uses a *dynamic*
// `await import("../supabase/server")` rather than a static top-level import
// — a static import would be evaluated (and throw) the instant this whole
// module is loaded by source.test.ts, before any `isTestEnv` check could run.
// The dynamic import is only ever actually invoked on the non-test path.
//
// Permission model: functions that touch tenant- or guide-scoped data take a
// `StudioActor` and enforce the exact same rules as the RLS policies in
// supabase/migrations/20260805063611_rls_policies.sql (admin: everything;
// company: own tenant; guide: own items + company's base list, read-only).
// Now that real Supabase Auth + RLS exist on the non-test path, these in-code
// checks are a second, redundant line of defence rather than the only one —
// which is the correct direction to be redundant in. Two of them
// (setGuideStatus's company/admin-only gate, and listBoatTourCatalog's
// admin-only gate) are stricter than RLS and are therefore load-bearing, not
// just redundant — see their own comments below.

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

import { CATEGORY_MAP } from "../categories";
import type { MapPin } from "../data";
import { parseBoatLocalCruise } from "../boatlocalCatalog";
import { initialFromName, uniqueSlug } from "../slug";
import type { Brand, CategoryId, Guide, Place } from "../types";
import type { BoatTour as BoatTourView } from "../types";
import { fakeId, fakeStore } from "./fakeStore";
import type {
  AnalyticsRange,
  AnalyticsSummaryRow,
  BoatLocalCruise,
  BoatTourRecord,
  BoatTourStatus,
  CompanyRecord,
  CompanyStatus,
  CompanyType,
  CreateCompanyInput,
  EventPlatform,
  EventRecord,
  EventType,
  GuideRecord,
  GuideStatus,
  InviteGuideInput,
  NewEventInput,
  NewGuestReviewInput,
  RecommendationOwnerType,
  RecommendationRecord,
  SaveBoatTourInput,
  SaveRecommendationInput,
  StudioActor,
  UpdateGuideProfileInput,
} from "./types";
import { StudioPermissionError } from "./types";

// Booking hand-off (PRD §5.5 / §13: "no live availability API in v1") is
// intentionally NOT re-implemented here. The real, tested implementation —
// click-id minting, the boatlocal.nl URL builder, and the signed inbound
// webhook that reports booking outcomes back — already lives in
// src/lib/attribution.ts (`createClickId`, `buildBookingUrl`); see
// docs/attribution.md for the full flow. `BoatTourRecord.bookingUrl` below
// is exactly the value `attribution.ts`'s
// `buildBookingUrl({ bookingUrl, clickId, ... })` appends tracking params
// onto — sourced verbatim from BoatLocal's own catalogue feed for a synced
// tour (see syncCruiseFromBoatLocal further down), or admin-entered for a
// manually curated one.

// =============================================================================
// Test-environment detection + Supabase client tiers.
// =============================================================================

// Vitest sets this automatically (verified empirically — see file header).
// Deliberately narrow (not also keyed off NODE_ENV==='test') so a
// misconfigured production NODE_ENV can never silently divert real traffic
// to the in-memory fake store.
const isTestEnv = process.env.VITEST === "true";

/**
 * Server-side signal for "this event was recorded from a non-production
 * deployment" — the replacement for manually spotting TEST-/E2E-/STG-
 * `booking_id` or `bkl_TEST_`/`bkl_E2E_`/`bkl_STG_` `click_id` prefixes,
 * BoatLocal's own testing convention that had already left behind rows
 * requiring manual cleanup twice (docs/attribution.md). Both teams agreed a
 * proper flag replaces that going forward.
 *
 * Vercel sets `VERCEL_ENV` automatically on every real deployment —
 * `"production"`, `"preview"`, or `"development"` — so a genuine staging/
 * preview deployment (which shares this app's ONE database with production;
 * there is no separate staging Supabase project) always has this positively
 * set to something other than `"production"`.
 *
 * Deliberately treats a genuinely UNSET var as "not test" rather than "test"
 * — the opposite of the seemingly-more-cautious reading. This is not a
 * loophole: a real Vercel deployment never leaves it unset (Vercel sets it
 * unconditionally), so the only place it's ever actually unset is a bare
 * `next dev`, `npx vitest run` (this file's own fakeStore-backed test suite,
 * which never touches this var), or `npm run test:integration`'s plain
 * `node` process. Treating "unset" as test-like would tag literally every
 * event either suite has ever recorded, breaking the whole existing
 * assertion surface of both — every analytics-count test in
 * src/lib/data/source.test.ts and every real-Postgres booking test in
 * source.integration.test.ts. A test that specifically wants to exercise the
 * is_test=true path stubs this value explicitly (`vi.stubEnv("VERCEL_ENV",
 * "preview")`) rather than relying on an ambient default either way.
 */
function isNonProductionDeployment(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  return vercelEnv != null && vercelEnv !== "production";
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Constructs a fresh anon-key client. Deliberately NOT given an explicit
 * `ReturnType<typeof createSupabaseJsClient>` annotation anywhere in this
 * file (verified empirically): annotating with the generic function's
 * ReturnType, rather than letting it infer from this concrete call, loses
 * the argument-driven generic inference and makes every `.rpc()`/`.insert()`
 * call below fail to type-check (Database resolves to `{}` instead of the
 * permissive default). Letting TypeScript infer this function's return type
 * from the body keeps it concrete and well-typed for every caller.
 */
function makeAnonClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Guest-facing Supabase reads require NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY. Check .env.local.",
    );
  }
  return createSupabaseJsClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Plain anon-key client, no session/cookies — matches Postgres role `anon`
 * exactly (see file header's client-tier note). Used only by guest-facing
 * functions. Safe to cache at module scope: unlike the cookie-bound
 * `authedClient`, this client carries no per-request identity.
 */
let cachedAnonClient: ReturnType<typeof makeAnonClient> | null = null;
function anonClient(): ReturnType<typeof makeAnonClient> {
  if (cachedAnonClient) return cachedAnonClient;
  cachedAnonClient = makeAnonClient();
  return cachedAnonClient;
}

/**
 * Request-scoped, cookie-bound client for the signed-in user's own session
 * (src/lib/supabase/server.ts) — matches Postgres role `authenticated` and
 * is what RLS checks against. Dynamically imported; see the file header for
 * why a static import here would break src/lib/data/source.test.ts.
 */
async function authedClient() {
  const { createClient } = await import("../supabase/server");
  return createClient();
}

/**
 * Service-role client (src/lib/supabase/admin.ts) — bypasses RLS entirely.
 * Used by findAttributedClick/recordBookingOutcome below, for the
 * BoatLocal conversion webhook: that caller is neither a guest (anon can
 * only INSERT events, never read them back — see "guest_insert_events" in
 * supabase/migrations/20260805063611_rls_policies.sql) nor a signed-in
 * Studio actor with a session to scope against. It's BoatLocal's own
 * server calling ours directly, authenticated only by the HMAC signature
 * attributionWebhook.ts already verifies before either function below is
 * ever reached — there is no narrower real client to reach for here.
 * Also used by getCompanyReviewStats, for the same reason: guest_reviews
 * has no anon/authenticated SELECT policy at all (see that table's own
 * migration comment), so an aggregate-only, PII-free rollup for the guest
 * Review screen has nowhere narrower to read from either.
 * Dynamically imported for the same reason authedClient() is (see file
 * header): a static import would break source.test.ts.
 */
async function adminClient() {
  const { createAdminClient } = await import("../supabase/admin");
  return createAdminClient();
}

// =============================================================================
// Row shapes (snake_case, mirroring supabase/migrations/20260805063610_init_schema.sql
// column-for-column) + mappers into this file's camelCase *Record types.
// =============================================================================

interface CompanyRow {
  id: string;
  name: string;
  company_type: CompanyType | null;
  app_name: string;
  brand_primary: string;
  brand_primary_dark: string;
  brand_accent: string;
  brand_surround: string;
  logo_url: string | null;
  campaign_params: string | null;
  google_review_url: string | null;
  tripadvisor_review_url: string | null;
  review_platform: "google" | "tripadvisor";
  custom_domain: string | null;
  status: CompanyStatus;
  owner_email: string | null;
  owner_status: "invited" | "active" | null;
  // owner_invite_token is deliberately NOT declared here. This interface
  // shapes every `select("*")` result this module works with, and
  // fromCompanyRow() below is the ONLY place a CompanyRow becomes a
  // CompanyRecord — omitting the field here is what makes it impossible for
  // the token to leak into CompanyRecord (and from there into any
  // guest-facing Brand) by accident. The one place that legitimately needs
  // the token — src/app/join/[token]/page.tsx — selects it with an explicit
  // column list via the admin client instead of going through this type.
  created_at: string;
  updated_at: string;
}

function fromCompanyRow(row: CompanyRow): CompanyRecord {
  return {
    id: row.id,
    name: row.name,
    companyType: row.company_type,
    appName: row.app_name,
    brandPrimary: row.brand_primary,
    brandPrimaryDark: row.brand_primary_dark,
    brandAccent: row.brand_accent,
    brandSurround: row.brand_surround,
    logoUrl: row.logo_url,
    campaignParams: row.campaign_params,
    googleReviewUrl: row.google_review_url,
    tripadvisorReviewUrl: row.tripadvisor_review_url,
    reviewPlatform: row.review_platform,
    customDomain: row.custom_domain,
    status: row.status,
    ownerEmail: row.owner_email,
    ownerStatus: row.owner_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface GuideRow {
  id: string;
  company_id: string;
  name: string;
  email: string;
  slug: string;
  avatar_url: string | null;
  avatar_initial: string;
  welcome_message: string;
  status: GuideStatus;
  invite_token: string | null;
  created_at: string;
  updated_at: string;
}

function fromGuideRow(row: GuideRow): GuideRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    email: row.email,
    slug: row.slug,
    avatarUrl: row.avatar_url,
    avatarInitial: row.avatar_initial,
    welcomeMessage: row.welcome_message,
    status: row.status,
    inviteToken: row.invite_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface RecommendationRow {
  id: string;
  company_id: string;
  owner_type: RecommendationOwnerType;
  guide_id: string | null;
  categories: CategoryId[];
  name: string;
  area: string;
  address: string;
  lng: number;
  lat: number;
  note: string;
  hours: string;
  photos: string[];
  visible: boolean;
  google_rating: number | null;
  google_review_count: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function fromRecommendationRow(row: RecommendationRow): RecommendationRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    ownerType: row.owner_type,
    guideId: row.guide_id,
    categories: row.categories,
    name: row.name,
    area: row.area,
    address: row.address,
    lng: row.lng,
    lat: row.lat,
    note: row.note,
    hours: row.hours,
    photos: row.photos,
    visible: row.visible,
    googleRating: row.google_rating,
    googleReviewCount: row.google_review_count,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface BoatTourRow {
  id: string;
  name: string;
  area: string;
  lng: number;
  lat: number;
  meta: string;
  note: string;
  booking_url: string;
  photos: string[];
  position: number;
  status: BoatTourStatus;
  created_at: string;
  updated_at: string;
  boatlocal_id: string | null;
  fareharbor_pk: number | null;
  slug: string | null;
  cruise_type: string | null;
  active: boolean | null;
  deactivation_reason: string | null;
  boatlocal_updated_at: string | null;
  boatlocal_headline: string | null;
  location_source: string | null;
  cruise_duration: string | null;
  starting_price_cents: number | null;
  price_currency: string | null;
}

function fromBoatTourRow(row: BoatTourRow): BoatTourRecord {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    lng: row.lng,
    lat: row.lat,
    meta: row.meta,
    note: row.note,
    bookingUrl: row.booking_url,
    photos: row.photos,
    position: row.position,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    boatlocalId: row.boatlocal_id,
    fareharborPk: row.fareharbor_pk,
    slug: row.slug,
    cruiseType: row.cruise_type,
    boatlocalActive: row.active,
    deactivationReason: row.deactivation_reason,
    boatlocalUpdatedAt: row.boatlocal_updated_at,
    boatlocalHeadline: row.boatlocal_headline,
    locationSource: row.location_source,
    cruiseDuration: row.cruise_duration,
    startingPriceCents: row.starting_price_cents,
    priceCurrency: row.price_currency,
  };
}

interface CompanyBoatFeatureRow {
  company_id: string;
  boat_tour_id: string;
  is_featured: boolean;
  position: number;
  created_at: string;
}

// =============================================================================
// Guest-facing reads (unauthenticated — matches the `anon` RLS policies).
// =============================================================================

/**
 * Exported for src/lib/guestServerContext.ts's platform-default-company
 * fallback (see getPlatformDefaultCompany above): that caller needs the same
 * CompanyRecord -> Brand mapping getCompanyBrand already applies, but starts
 * from a CompanyRecord it already has in hand rather than an id to look up.
 */
export function toBrand(company: CompanyRecord): Brand {
  return {
    id: company.id,
    companyName: company.name,
    appName: company.appName,
    primary: company.brandPrimary,
    primaryDark: company.brandPrimaryDark,
    accent: company.brandAccent,
    surround: company.brandSurround,
    logoUrl: company.logoUrl,
  };
}

function toGuideView(guide: GuideRecord): Guide {
  return {
    id: guide.id,
    name: guide.name,
    slug: guide.slug,
    welcome: guide.welcomeMessage,
    avatarInitial: guide.avatarInitial,
  };
}

function toPlace(rec: RecommendationRecord): Place {
  return {
    id: rec.id,
    name: rec.name,
    categories: rec.categories,
    area: rec.area,
    address: rec.address,
    lng: rec.lng,
    lat: rec.lat,
    note: rec.note,
    hours: rec.hours,
    photos: rec.photos,
    googleRating: rec.googleRating,
    googleReviewCount: rec.googleReviewCount,
  };
}

function toBoatTourView(tour: BoatTourRecord): BoatTourView {
  return {
    id: tour.id,
    name: tour.name,
    area: tour.area,
    lng: tour.lng,
    lat: tour.lat,
    meta: tour.meta,
    durationLabel: tour.cruiseDuration,
    priceLabel:
      tour.startingPriceCents != null
        ? formatStartingPriceCents(tour.startingPriceCents, tour.priceCurrency ?? "EUR")
        : null,
    note: tour.note,
    bookingUrl: tour.bookingUrl,
    photos: tour.photos,
    position: tour.position,
  };
}

// `companies.id` is a real `uuid` column, but every id-keyed lookup below is
// also called with `?company=`'s raw value, which — unlike a subdomain —
// is not guaranteed to even look like an id: DEFAULT_BRAND.id / src/lib/
// brand.ts's four other preview-swatch keys ("coastal"/"coral"/"forest"/
// "tulip"/"ink") flow through here too whenever a guest URL carries none or
// an unrecognised `?company=`. Postgres raises a hard error (invalid input
// syntax for type uuid) for a non-UUID equality filter on a uuid column,
// rather than quietly matching zero rows the way a text column would have —
// so every real-backend branch below must short-circuit to "not found" for
// a non-UUID-shaped id BEFORE querying, to keep this function's "unknown id
// behaves exactly like no id" contract that every caller (not least
// src/lib/guestServerContext.ts's swatch-fallback) already relies on.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Id -> brand resolution (PRD §11, superseding §13.1's subdomain-routing
 * plan — see src/lib/guestBrand.ts's header comment for why `?company=<id>`
 * is now the real, permanent mechanism). Called from Proxy in the real app
 * to resolve the guest's `?company=` query param before rendering.
 *
 * Real backend: anon client, plain select filtered to status='active' —
 * previously an RPC (`company_by_subdomain`), but a direct-by-id lookup
 * needs no server-side helper function of its own; guest_public_read
 * (status='active') still does the RLS-level filtering redundantly.
 */
export async function getCompanyBrand(id: string): Promise<Brand | null> {
  if (isTestEnv) {
    const company = fakeStore.companies.find((c) => c.id === id && c.status === "active");
    return company ? toBrand(company) : null;
  }
  if (!isUuid(id)) return null;

  const { data, error } = await anonClient()
    .from("companies")
    .select("*")
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data ? toBrand(fromCompanyRow(data as CompanyRow)) : null;
}

/**
 * Full company row for an id, for callers that need more than brand
 * colours (e.g. review URLs, campaign params). Deliberately NOT status-
 * filtered — Studio's own tenant lookup needs to find a company regardless
 * of status (e.g. to see or reactivate a deactivated one). Guest-facing
 * code must use getActiveCompanyRecord below instead; using this one from
 * a guest code path is almost certainly a bug.
 *
 * Real backend: authed client (never anon — see doc above), plain select.
 * RLS: admin_full_access (any status) or company_and_guide_select_own (own
 * company_id, any status, regardless of role).
 */
export async function getCompanyRecord(id: string): Promise<CompanyRecord | null> {
  if (isTestEnv) {
    return fakeStore.companies.find((c) => c.id === id) ?? null;
  }
  if (!isUuid(id)) return null;

  const supabase = await authedClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromCompanyRow(data as CompanyRow) : null;
}

/**
 * Guest-facing version of getCompanyRecord: returns null for a deactivated
 * company exactly as it would for a nonexistent one, so every value derived
 * from the result (companyId, guide, recommendations, boat tours) collapses
 * to "not found" together, rather than leaving a real companyId in play
 * that still unlocks a deactivated tenant's data through getPlaces /
 * getBoatTours / getMapPins.
 *
 * Real backend: anon client, own direct query (not a delegation to
 * getCompanyRecord, which is deliberately authed-only) — guest_public_read
 * enforces status='active' redundantly server-side too.
 */
export async function getActiveCompanyRecord(id: string): Promise<CompanyRecord | null> {
  if (isTestEnv) {
    const company = fakeStore.companies.find((c) => c.id === id);
    return company && company.status === "active" ? company : null;
  }
  if (!isUuid(id)) return null;

  const { data, error } = await anonClient()
    .from("companies")
    .select("*")
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data ? fromCompanyRow(data as CompanyRow) : null;
}

/**
 * The company whose OWN domain (companies.custom_domain, e.g.
 * "map.offcourseamsterdam.com") matches the incoming request's Host header —
 * see src/lib/guestServerContext.ts for where this sits in the fallback
 * chain (after an explicit `?company=`, before the shared platform default).
 *
 * Same anon/active contract as getActiveCompanyRecord just above: guest
 * traffic on a custom domain is unauthenticated, and an inactive company's
 * domain should read as "nothing here" (falls through to the platform
 * default / neutral identity), not error.
 */
export async function getCompanyByCustomDomain(host: string): Promise<CompanyRecord | null> {
  const normalized = host.trim().toLowerCase();
  if (!normalized) return null;

  if (isTestEnv) {
    const company = fakeStore.companies.find(
      (c) => c.customDomain === normalized && c.status === "active",
    );
    return company ?? null;
  }

  const { data, error } = await anonClient()
    .from("companies")
    .select("*")
    .eq("custom_domain", normalized)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data ? fromCompanyRow(data as CompanyRow) : null;
}

/**
 * The company shown to a guest who names none at all (bare root URL, no
 * `?company=` at all — see src/lib/guestServerContext.ts's own comment for
 * why that used to fall back to src/lib/brand.ts's hardcoded prototype
 * BRANDS.coastal instead of anything real). Returns null when no company has
 * been flagged yet (fresh install — src/lib/guestServerContext.ts falls back
 * to a neutral, honest "Map App" identity in that case, not a fabricated
 * business).
 *
 * No actor: this is an internal server-side lookup key, not a Studio/Admin
 * read gated by who's asking. Deliberately NOT status-filtered the way
 * getActiveCompanyRecord is: src/lib/guestServerContext.ts checks the
 * returned record's own `status` itself (an inactive platform default should
 * fall through to the neutral identity, not 404 outright — same "unknown vs
 * inactive" nuance getActiveCompanyRecord's own doc comment describes), and
 * Admin's /admin/default-company page needs to see a still-"setup" flagged
 * company too, not just an already-live one.
 *
 * Real backend: authed client, NOT anon, despite having no actor of its own
 * — the two callers need different visibility of the SAME row depending on
 * who's actually signed in for this request, which only authedClient()
 * (server.ts: "RLS as whoever is actually signed in for this request, or as
 * `anon` if nobody is") can give both at once:
 *   - a guest (no session) resolves through this exact client as anon
 *     anyway, so guest_public_read's `status = 'active'` still applies —
 *     identical behaviour to the anon client for that caller;
 *   - Admin's own authenticated session sees the row regardless of status
 *     (admin_full_access), which a plain anon client never could.
 */
export async function getPlatformDefaultCompany(): Promise<CompanyRecord | null> {
  if (isTestEnv) {
    if (!fakeStore.platformDefaultCompanyId) return null;
    return fakeStore.companies.find((c) => c.id === fakeStore.platformDefaultCompanyId) ?? null;
  }

  const supabase = await authedClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("is_platform_default", true)
    .maybeSingle();
  if (error) throw error;
  return data ? fromCompanyRow(data as CompanyRow) : null;
}

/**
 * Path segment -> guide (PRD §13.1: guide comes from the first path
 * segment, e.g. hotelv.map.boatlocal.nl/jan).
 *
 * Real backend: anon client, RPC `guide_by_slug(p_company_id, p_slug)`.
 * Relies on RLS's guest_public_read (status='active' AND
 * company_is_active) — no extra status filter added client-side.
 */
export async function getGuide(companyId: string, slug: string): Promise<Guide | null> {
  if (isTestEnv) {
    const guide = fakeStore.guides.find(
      (g) => g.companyId === companyId && g.slug === slug && g.status === "active",
    );
    return guide ? toGuideView(guide) : null;
  }

  const { data, error } = await anonClient().rpc("guide_by_slug", {
    p_company_id: companyId,
    p_slug: slug,
  });
  if (error) throw error;
  // guide_by_slug is `returns setof public.guides` with an internal
  // `limit 1`, so `data` is an array of 0 or 1 rows, never a bare object —
  // same shape as company_by_subdomain used to be before getCompanyBrand
  // switched to a plain select (see that function's own comment). Unwrap
  // before checking.
  const row = (data as GuideRow[] | null)?.[0];
  return row ? toGuideView(fromGuideRow(row)) : null;
}

/**
 * Visible recommendations for one tenant (guest map/list). Boats are never
 * included here — see getBoatTours.
 *
 * Real backend: anon client, plain select filtered to visible=true.
 */
export async function getPlaces(companyId: string): Promise<Place[]> {
  if (isTestEnv) {
    return fakeStore.recommendations
      .filter((r) => r.companyId === companyId && r.visible)
      .map(toPlace);
  }

  const { data, error } = await anonClient()
    .from("recommendations")
    .select("*")
    .eq("company_id", companyId)
    .eq("visible", true);
  if (error) throw error;
  return ((data ?? []) as RecommendationRow[]).map((row) => toPlace(fromRecommendationRow(row)));
}

interface CompanyBoatFeatureJoinRow {
  position: number;
  boat_tours: BoatTourRow | BoatTourRow[] | null;
}

/**
 * Featured, active boat tours for one tenant, in the *tenant's own* featured
 * order (company_boat_features.position, set via Studio > Boat tours'
 * arrow-reordering — see setBoatFeature) — not the catalog's global
 * position. Two companies featuring the same six tours can order their
 * carousels differently; at seed time the two happen to match, which is why
 * this looks identical to sorting by the tour's own position until a company
 * actually reorders.
 *
 * Real backend: anon client, `company_boat_features` joined to `boat_tours`,
 * ordered by the *feature's* position column; `status='active'` on the
 * embedded tour is filtered client-side after fetch (an embedded-resource
 * filter would need `!inner`, and this keeps the query shape closest to the
 * fakeStore version).
 */
export async function getBoatTours(companyId: string): Promise<BoatTourView[]> {
  if (isTestEnv) {
    const features = new Map(
      fakeStore.companyBoatFeatures
        .filter((f) => f.companyId === companyId && f.isFeatured)
        .map((f) => [f.boatTourId, f]),
    );
    return fakeStore.boatTours
      .filter((t) => features.has(t.id) && t.status === "active")
      .sort((a, b) => features.get(a.id)!.position - features.get(b.id)!.position)
      .map(toBoatTourView);
  }

  const { data, error } = await anonClient()
    .from("company_boat_features")
    .select("position, boat_tours(*)")
    .eq("company_id", companyId)
    .eq("is_featured", true)
    .order("position");
  if (error) throw error;

  const rows = (data ?? []) as unknown as CompanyBoatFeatureJoinRow[];
  return rows
    .map((row) => (Array.isArray(row.boat_tours) ? row.boat_tours[0] : row.boat_tours))
    .filter((tour): tour is BoatTourRow => !!tour && tour.status === "active")
    .map((tour) => toBoatTourView(fromBoatTourRow(tour)));
}

interface MapPinRow {
  id: string;
  name: string;
  categories: CategoryId[];
  area: string;
  lng: number;
  lat: number;
  note: string;
  meta: string;
  cruise_duration: string | null;
  starting_price_cents: number | null;
  price_currency: string | null;
  photos: string[];
  is_boat: boolean;
  booking_url: string | null;
  google_rating: number | null;
  google_review_count: number | null;
}

/**
 * Unified pin feed for the guest map — boats first (the booking business
 * model must never be buried), then everything else. Matches
 * src/lib/data.ts's ALL_PINS shape exactly.
 *
 * DELIBERATELY UNFILTERED by coordinate validity: this same function backs
 * BOTH the Map and List screens (src/app/(guest)/map/page.tsx and
 * .../list/page.tsx), and List has no use for lat/lng at all. A boat tour
 * synced from BoatLocal with no `cruise.departure` data yet sits at the
 * lat=0/lng=0 sentinel syncCruiseFromBoatLocal writes when a NOT NULL
 * column has nothing real to put in it (BoatLocal's public catalogue feed
 * has no location field in production as of this writing — see that
 * function's own doc comment) — it is still a perfectly valid
 * recommendation. REGRESSION, found live 2026-08-24: an earlier version of
 * this fix filtered it out HERE, which silently emptied the List screen
 * too (a guest saw "0 recommendations" everywhere, not just an empty map).
 * The actual exclusion now lives client-side in GuestMapScreen.tsx, which
 * derives a separate `mappablePins` array for what it hands to <MapPins> —
 * never here.
 *
 * Real backend: anon client, RPC `guest_map_pins(p_company_id)` — boats-
 * first ordering already built into the function.
 */
export async function getMapPins(companyId: string): Promise<MapPin[]> {
  if (isTestEnv) {
    const [tours, places] = await Promise.all([getBoatTours(companyId), getPlaces(companyId)]);

    const boatPins: MapPin[] = tours.map((t) => ({
      id: t.id,
      name: t.name,
      categories: ["boats"],
      area: t.area,
      lng: t.lng,
      lat: t.lat,
      note: t.note,
      meta: t.meta,
      durationLabel: t.durationLabel,
      priceLabel: t.priceLabel,
      photos: t.photos,
      isBoat: true,
      bookingUrl: t.bookingUrl,
      googleRating: null,
      googleReviewCount: null,
    }));

    const placePins: MapPin[] = places.map((p) => ({
      id: p.id,
      name: p.name,
      categories: p.categories,
      area: p.area,
      lng: p.lng,
      lat: p.lat,
      note: p.note,
      meta: p.hours,
      photos: p.photos,
      isBoat: false,
      googleRating: p.googleRating,
      googleReviewCount: p.googleReviewCount,
    }));

    return [...boatPins, ...placePins];
  }

  const { data, error } = await anonClient().rpc("guest_map_pins", { p_company_id: companyId });
  if (error) throw error;
  return ((data ?? []) as MapPinRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    categories: row.categories,
    area: row.area,
    lng: row.lng,
    lat: row.lat,
    note: row.note,
    meta: row.meta,
    durationLabel: row.is_boat ? row.cruise_duration : null,
    priceLabel:
      row.is_boat && row.starting_price_cents != null
        ? formatStartingPriceCents(row.starting_price_cents, row.price_currency ?? "EUR")
        : null,
    photos: row.photos,
    isBoat: row.is_boat,
    bookingUrl: row.is_boat ? (row.booking_url ?? undefined) : undefined,
    googleRating: row.google_rating,
    googleReviewCount: row.google_review_count,
  }));
}

/**
 * Fires an analytics event (PRD §10). Guest app calls this unauthenticated
 * and fire-and-forget — matches the `anon` insert-only policy on `events`.
 * Also legitimately callable from an authenticated Studio context (via
 * authenticated_insert_events); the plain anon-key client used here still
 * succeeds in that case since it carries no session either way.
 */
export async function recordEvent(input: NewEventInput): Promise<void> {
  // Tagged for every event type, not just booking_outcome (see
  // isNonProductionDeployment's own doc comment): a staging/preview
  // deployment shares this app's one real database with production, so
  // whatever a guest or Studio session does there — app opens, saved tips,
  // review clicks — is exactly as much "not real activity" as a test
  // booking is. Scoping this narrower to only booking-outcome events would
  // leave every other count exposed to the same kind of pollution the
  // is_test column exists to prevent.
  const isTest = isNonProductionDeployment();

  if (isTestEnv) {
    fakeStore.events.push({
      id: fakeId("event"),
      eventType: input.eventType,
      companyId: input.companyId ?? null,
      guideId: input.guideId ?? null,
      boatTourId: input.boatTourId ?? null,
      recommendationId: input.recommendationId ?? null,
      guestSessionId: input.guestSessionId ?? null,
      platform: (input.platform ?? "unknown") as EventPlatform,
      metadata: input.metadata ?? {},
      occurredAt: new Date().toISOString(),
      isTest,
    });
    return;
  }

  const { error } = await anonClient()
    .from("events")
    .insert({
      event_type: input.eventType,
      company_id: input.companyId ?? null,
      guide_id: input.guideId ?? null,
      boat_tour_id: input.boatTourId ?? null,
      recommendation_id: input.recommendationId ?? null,
      guest_session_id: input.guestSessionId ?? null,
      platform: input.platform ?? "unknown",
      metadata: input.metadata ?? {},
      is_test: isTest,
    });
  if (error) throw error;
}

/**
 * Records a guest's star rating for the Review screen (PRD §5.6) — see
 * supabase/migrations/20260824000000_guest_reviews.sql. Same anon-insert-
 * only, is_test-tagged shape as recordEvent above, against a separate table
 * rather than overloading `events.metadata` (which is what the private-
 * feedback path used to do before this table existed).
 *
 * ONE function for both call sites this table's migration comment
 * describes, distinguished only by which fields the caller passes:
 *   - a bare star pick: `{ companyId, rating }` — feedbackText/contact left
 *     undefined, so `guest_reviews.feedback_text`/`.contact` land null.
 *   - a private-feedback submission: the same, plus `feedbackText` (and
 *     optionally `contact`).
 * Both are legitimate, separate rows — see the migration for why this isn't
 * deduped into "one row per session" (there is no guest session id to
 * correlate them by in this anonymous flow).
 */
export async function recordGuestReview(input: NewGuestReviewInput): Promise<void> {
  const isTest = isNonProductionDeployment();

  if (isTestEnv) {
    fakeStore.guestReviews.push({
      id: fakeId("guest_review"),
      companyId: input.companyId,
      rating: input.rating,
      feedbackText: input.feedbackText ?? null,
      contact: input.contact ?? null,
      createdAt: new Date().toISOString(),
      isTest,
    });
    return;
  }

  const { error } = await anonClient()
    .from("guest_reviews")
    .insert({
      company_id: input.companyId,
      rating: input.rating,
      feedback_text: input.feedbackText ?? null,
      contact: input.contact ?? null,
      is_test: isTest,
    });
  if (error) throw error;
}

export interface CompanyReviewStats {
  /** Null when `count` is 0 — there is nothing to average. */
  averageRating: number | null;
  /** How many guests have picked a star so far (private-feedback-only rows, whose rating is null, don't count). */
  count: number;
}

/**
 * A real, aggregate-only rollup of this app's OWN guest_reviews ratings —
 * the trust signal the Review screen shows guests considering leaving one
 * ("join the N who already have"), sourced from data this app actually
 * collected rather than a fabricated number. Founder-approved addition,
 * 2026-09-01, alongside a round of review-conversion research; explicitly
 * NOT a review-gating change — every guest still sees the exact same count
 * regardless of their own (or any) star pick. See guest_reviews' migration
 * comment for why this table has no anon/authenticated SELECT policy and
 * why this function only ever touches the `rating` column: feedback_text/
 * contact may carry PII and this rollup has no reason to read them.
 *
 * Public/guest-facing (no StudioActor) — same posture as
 * getActiveCompanyRecord/getReviewOptions, which the Review page already
 * calls with no auth check of its own.
 */
export async function getCompanyReviewStats(companyId: string): Promise<CompanyReviewStats> {
  if (isTestEnv) {
    const ratings = fakeStore.guestReviews
      .filter((r) => r.companyId === companyId && !r.isTest && r.rating !== null)
      .map((r) => r.rating as number);
    return ratings.length === 0
      ? { averageRating: null, count: 0 }
      : { averageRating: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length };
  }

  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("guest_reviews")
    .select("rating")
    .eq("company_id", companyId)
    .eq("is_test", false)
    .not("rating", "is", null);
  if (error) throw error;

  const ratings = (data ?? []).map((row) => row.rating as number);
  return ratings.length === 0
    ? { averageRating: null, count: 0 }
    : { averageRating: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length };
}

// =============================================================================
// BoatLocal booking-attribution webhook (docs/attribution.md).
//
// findAttributedClick/recordBookingOutcome are what
// src/app/api/webhooks/boatlocal-booking/route.ts calls once a signed
// request has been verified — they replace the old dev-only in-memory
// stand-in (src/lib/attributionStore.ts, now deleted) with real reads/
// writes against the `events` table, following the same recordEvent()
// shape everything else here uses rather than inventing a parallel one.
//
// THE CLICK IS A boat_book_click EVENT, NOT A SEPARATE RECORD. The guest
// screens (GuestMapScreen/GuestListScreen/GuestSavedScreen) already record
// a real "boat_book_click" event the moment a guest taps "Book this tour" —
// this reuses that exact row rather than keeping a second, disconnected
// "clicks" table in sync with it. The one addition on the write side is
// that those three call sites now pass `metadata: { clickId }`, using the
// same id embedded in the booking URL's `ref` param (see GuestPinAction's
// doc comment in src/lib/guestActions.ts), so this can find it later.
// =============================================================================

export interface AttributedClick {
  companyId: string | null;
  guideId: string | null;
  boatTourId: string | null;
}

/**
 * Finds the boat_book_click event carrying this exact clickId in its
 * metadata. Returns null when there is no such event — an unattributed
 * booking, not an error (see the webhook route for why that's still a 200,
 * not a failure).
 */
export async function findAttributedClick(clickId: string): Promise<AttributedClick | null> {
  if (isTestEnv) {
    const match = fakeStore.events.find(
      (e) => e.eventType === "boat_book_click" && e.metadata?.clickId === clickId,
    );
    return match ? { companyId: match.companyId, guideId: match.guideId, boatTourId: match.boatTourId } : null;
  }

  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("events")
    .select("company_id, guide_id, boat_tour_id")
    .eq("event_type", "boat_book_click")
    .eq("metadata->>clickId", clickId)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { companyId: data.company_id, guideId: data.guide_id, boatTourId: data.boat_tour_id };
}

export interface RecordBookingOutcomeInput {
  clickId: string;
  bookingId: string;
  event: "booking.confirmed" | "booking.cancelled";
  tourId: string;
  guests: number;
  amountCents: number;
  currency: string;
  bookedAt: string;
  /**
   * Echoed fallback-attribution fields from the webhook payload (see
   * parseBookingWebhookPayload in src/lib/attribution.ts) — used only when
   * the clickId lookup itself comes up empty. See resolveFallbackAttribution
   * below for the validation this goes through before either id is ever
   * trusted into a foreign-key column.
   */
  sourceCompany?: string;
  sourceDistributor?: string;
}

export interface RecordBookingOutcomeResult {
  /** False on a retried delivery of a booking already recorded — see the webhook route's idempotency contract in docs/attribution.md. */
  inserted: boolean;
  /** Whether a matching click was found — independent of `inserted`; a dedup still reports the original delivery's attribution. */
  attributed: boolean;
}

/**
 * Fallback attribution (point 6 of the go-live plan, docs/attribution.md):
 * when a booking's clickId doesn't resolve via findAttributedClick — the
 * click record expired, or click tracking never fired for this particular
 * booking — but the webhook payload echoes `source_company` (and optionally
 * `source_distributor`), those are used instead of leaving the booking
 * fully unattributed.
 *
 * This is safe to trust despite being caller-supplied data: the entire
 * webhook body is already HMAC-verified by the time recordBookingOutcome
 * ever runs (see attributionWebhook.ts) — the risk here isn't spoofing, it's
 * a stale or typo'd id, which is exactly why each one is resolved against a
 * real row before being trusted into a foreign-key column rather than
 * inserted blind.
 *
 * JUDGMENT CALL: an unresolvable companyId means no fallback at all (the
 * booking stays unattributed — a company id we can't verify is not a safer
 * bet than no attribution). An unresolvable guide slug under an otherwise-
 * valid company, though, only drops the guide half — the booking still
 * attributes to the company, the same "company-level, no specific guide"
 * shape a real company-wide share link's click already produces via
 * findAttributedClick. This distinction isn't spelled out in the go-live
 * plan; it was chosen to mirror how a null guideId already behaves
 * everywhere else in this file rather than invented from scratch.
 *
 * BUG FIXED (found by BoatLocal's team live-testing against our real
 * production webhook, not by any automated check here): this used to look
 * the guide up by `.eq("id", guideDistributorSlug)` — treating the echoed
 * `source_distributor` as the guide's UUID `id`. It is not: `distributor`
 * (src/lib/attribution.ts's `buildBookingUrl`) has always sent the guide's
 * *slug*, not its id, so this was resolving against the wrong column
 * entirely — it only ever appeared to work in manual testing because a
 * hand-picked UUID happened to match a real seeded guide's id by
 * coincidence. Fixed to resolve by `slug` (a text column — no type-mismatch
 * possible, so this alone also can't 500 the way the company lookup could).
 *
 * SECOND BUG FIXED, same report: `companyId` was passed straight into
 * `.eq("id", companyId)` with no shape check. Postgres raises a hard error
 * for a non-UUID string compared against a `uuid` column (`companies.id`)
 * rather than returning zero rows, and that error was left to propagate
 * as an unhandled exception — a malformed `source_company` (or a
 * deliberate malicious one) 500'd the whole webhook instead of the
 * "can't verify it, so no fallback" behaviour this function's own doc
 * comment already promised. Guarded with the same isUuid() check
 * getCompanyRecord/getActiveCompanyRecord above already use for exactly
 * this reason.
 */
async function resolveFallbackAttribution(
  companyId: string | undefined,
  guideSlug: string | undefined,
): Promise<AttributedClick | null> {
  if (!companyId || !isUuid(companyId)) return null;

  if (isTestEnv) {
    const company = fakeStore.companies.find((c) => c.id === companyId);
    if (!company) return null;

    let resolvedGuideId: string | null = null;
    if (guideSlug) {
      const guide = fakeStore.guides.find(
        (g) => g.slug === guideSlug && g.companyId === companyId,
      );
      resolvedGuideId = guide?.id ?? null;
    }
    return { companyId: company.id, guideId: resolvedGuideId, boatTourId: null };
  }

  const supabase = await adminClient();
  const { data: companyRow, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();
  if (companyError) throw companyError;
  if (!companyRow) return null;

  let resolvedGuideId: string | null = null;
  if (guideSlug) {
    const { data: guideRow, error: guideError } = await supabase
      .from("guides")
      .select("id")
      .eq("slug", guideSlug)
      .eq("company_id", companyId)
      .maybeSingle();
    if (guideError) throw guideError;
    resolvedGuideId = (guideRow as { id: string } | null)?.id ?? null;
  }

  return { companyId, guideId: resolvedGuideId, boatTourId: null };
}

/**
 * Records a `booking_outcome` event for a completed/cancelled BoatLocal
 * booking, attributed to whichever company/guide/tour the original click
 * belongs to (null fields when unattributed, unless resolveFallbackAttribution
 * above finds a validated echoed company/guide instead).
 *
 * Deduped on (`bookingId`, `event`) in metadata, NOT `bookingId` alone —
 * BoatLocal retries any non-2xx response, so a retried delivery of the exact
 * same outcome must be a no-op, never a second row. But a confirmed booking
 * later cancelled is two DIFFERENT outcomes for the same bookingId, and both
 * must be recorded as their own event: a bookingId-only dedup key would
 * silently drop the cancellation as if it were a duplicate delivery of the
 * confirmation, which is exactly the bug this shape fixes (see
 * 20260823210000_net_cancelled_booking_outcomes.sql's own comment for the
 * other half of this fix — how those two rows then net to zero in every
 * "tours booked" style sum, rather than the cancellation inflating it).
 *
 * NOTE on rebooking: there is no "booking.rebooked" event — BoatLocal's own
 * rebook flow already decomposes into a `booking.cancelled` (old booking id)
 * plus a `booking.confirmed` (new booking id), which this function already
 * handles correctly as two independent bookingIds each going through the
 * dedup/netting logic above. No cross-linking between the two is attempted.
 *
 * `isTest` (see isNonProductionDeployment) is set here regardless of dedup:
 * this is the concrete, agreed case that's already left behind real cleanup
 * work (BoatLocal testing against our production webhook with no reachable
 * staging endpoint yet — docs/attribution.md) — every "tours booked"/
 * conversion-rate aggregate must exclude a row tagged this way by default.
 */
export async function recordBookingOutcome(
  input: RecordBookingOutcomeInput,
): Promise<RecordBookingOutcomeResult> {
  let click = await findAttributedClick(input.clickId);
  if (!click && (input.sourceCompany || input.sourceDistributor)) {
    click = await resolveFallbackAttribution(input.sourceCompany, input.sourceDistributor);
  }
  const metadata = {
    clickId: input.clickId,
    bookingId: input.bookingId,
    event: input.event,
    tourId: input.tourId,
    guests: input.guests,
    amountCents: input.amountCents,
    currency: input.currency,
    bookedAt: input.bookedAt,
  };
  const isTest = isNonProductionDeployment();

  if (isTestEnv) {
    const alreadyRecorded = fakeStore.events.some(
      (e) =>
        e.eventType === "booking_outcome" &&
        e.metadata?.bookingId === input.bookingId &&
        e.metadata?.event === input.event,
    );
    if (alreadyRecorded) return { inserted: false, attributed: !!click };

    fakeStore.events.push({
      id: fakeId("event"),
      eventType: "booking_outcome",
      companyId: click?.companyId ?? null,
      guideId: click?.guideId ?? null,
      boatTourId: click?.boatTourId ?? null,
      recommendationId: null,
      guestSessionId: null,
      platform: "unknown",
      metadata,
      occurredAt: new Date().toISOString(),
      isTest,
    });
    return { inserted: true, attributed: !!click };
  }

  const supabase = await adminClient();

  const { data: existing, error: existingError } = await supabase
    .from("events")
    .select("id")
    .eq("event_type", "booking_outcome")
    .eq("metadata->>bookingId", input.bookingId)
    .eq("metadata->>event", input.event)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { inserted: false, attributed: !!click };

  const { error } = await supabase.from("events").insert({
    event_type: "booking_outcome",
    company_id: click?.companyId ?? null,
    guide_id: click?.guideId ?? null,
    boat_tour_id: click?.boatTourId ?? null,
    platform: "unknown",
    metadata,
    is_test: isTest,
  });
  if (error) throw error;

  return { inserted: true, attributed: !!click };
}

export interface BookingOutcomeStatusEvent {
  event: "booking.confirmed" | "booking.cancelled";
  occurredAt: string;
  guests: number;
  amountCents: number;
  currency: string;
}

export interface BookingOutcomeStatus {
  bookingId: string;
  attributed: boolean;
  companyId: string | null;
  guideId: string | null;
  boatTourId: string | null;
  /** +1 per confirmed, -1 per cancelled — 0 means net cancelled, matching what every analytics RPC already counts this booking_id as. */
  netCount: number;
  events: BookingOutcomeStatusEvent[];
}

/**
 * Read-side counterpart to recordBookingOutcome — lets the CALLER (BoatLocal's
 * own team) verify a webhook delivery actually landed, without needing Admin
 * dashboard access or trusting our 200 response on faith. Built because they
 * asked for exactly this after their first live signed test against
 * production: "Where we can see this ourselves next time... Right now we're
 * trusting your 200 and can't verify independently."
 *
 * Deliberately narrow: returns only what's needed to confirm attribution and
 * net outcome (see BookingOutcomeStatus) — never a full row dump, and never
 * anything about a DIFFERENT booking_id than the one asked for. No Studio
 * actor exists for this caller (same as the webhook itself), so this uses
 * the service-role client directly, same posture as findAttributedClick.
 */
export async function getBookingOutcomeStatus(
  bookingId: string,
): Promise<BookingOutcomeStatus | null> {
  if (isTestEnv) {
    const rows = fakeStore.events.filter(
      (e) => e.eventType === "booking_outcome" && e.metadata?.bookingId === bookingId,
    );
    if (rows.length === 0) return null;
    return buildBookingOutcomeStatus(bookingId, rows);
  }

  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("events")
    .select("company_id, guide_id, boat_tour_id, metadata, occurred_at")
    .eq("event_type", "booking_outcome")
    .eq("metadata->>bookingId", bookingId)
    .order("occurred_at", { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) return null;

  return buildBookingOutcomeStatus(
    bookingId,
    data.map((row) => ({
      companyId: row.company_id as string | null,
      guideId: row.guide_id as string | null,
      boatTourId: row.boat_tour_id as string | null,
      metadata: row.metadata as Record<string, unknown>,
      occurredAt: row.occurred_at as string,
    })),
  );
}

/** Shared by both branches of getBookingOutcomeStatus above — every row for one bookingId shares the same attribution (it's set once, at first insert, and never changes on a later confirmed/cancelled row for that same id), so attribution is read off the first row while the net count sums every row. */
function buildBookingOutcomeStatus(
  bookingId: string,
  rows: Array<{
    companyId: string | null;
    guideId: string | null;
    boatTourId: string | null;
    metadata: Record<string, unknown> | null | undefined;
    occurredAt: string;
  }>,
): BookingOutcomeStatus {
  const first = rows[0];
  const events: BookingOutcomeStatusEvent[] = rows.map((row) => {
    const m = row.metadata ?? {};
    const event = m.event === "booking.cancelled" ? "booking.cancelled" : "booking.confirmed";
    return {
      event,
      occurredAt: row.occurredAt,
      guests: typeof m.guests === "number" ? m.guests : 0,
      amountCents: typeof m.amountCents === "number" ? m.amountCents : 0,
      currency: typeof m.currency === "string" ? m.currency : "EUR",
    };
  });
  const netCount = events.reduce((sum, e) => sum + (e.event === "booking.cancelled" ? -1 : 1), 0);

  return {
    bookingId,
    attributed: first.companyId != null,
    companyId: first.companyId,
    guideId: first.guideId,
    boatTourId: first.boatTourId,
    netCount,
    events,
  };
}

// =============================================================================
// BoatLocal cruise-catalogue sync (docs/attribution.md's "cruise catalogue
// sync" section) — shared by src/app/api/webhooks/boatlocal-cruise/route.ts
// (cruise.activated / cruise.deactivated) and
// src/app/api/cron/sync-boat-tours/route.ts's daily reconciliation pass.
//
// Like findAttributedClick/recordBookingOutcome above, every function here
// runs with no Studio session at all (an HMAC-verified webhook call or a
// cron job, neither of which is an `authenticated` Postgres role), so they
// all use the service-role client, never authedClient().
// =============================================================================

/**
 * Turns BoatLocal's duration/price fields into this table's existing
 * free-text `meta` line — the same "one guest-facing field" convention
 * BoatTourForm's manual entry already uses (see src/lib/admin/boatTourForm.ts's
 * own note on why there's no separate structured price column). Format:
 * "1 hour & 30 mins · from €29 pp" — starting_price is a from-price, EUR gets
 * its symbol (any other currency keeps its code with a space, e.g.
 * "from USD 29 pp"), integer prices stay bare and fractional ones get two
 * decimals ("from €22.50 pp").
 */
function formatCruiseMeta(cruise: BoatLocalCruise): string {
  const parts: string[] = [];
  if (cruise.cruiseDuration) parts.push(cruise.cruiseDuration);
  if (cruise.startingPrice != null) {
    const amount = Number.isInteger(cruise.startingPrice)
      ? String(cruise.startingPrice)
      : cruise.startingPrice.toFixed(2);
    const currency = cruise.currency ?? "EUR";
    parts.push(currency === "EUR" ? `from €${amount} pp` : `from ${currency} ${amount} pp`);
  }
  return parts.join(" · ");
}

/**
 * Feed euros -> stored integer cents for `starting_price_cents` (see the
 * 20260824020000_boat_tours_structured_meta.sql migration comment for why
 * cents). Math.round, not `* 100` alone: 22.5 * 100 is exactly 2250 in IEEE
 * 754, but that's luck of the particular value — e.g. 22.13 * 100 is
 * 2212.9999999999995, which would truncate to 2212 through any integer
 * coercion. Rounding makes every two-decimal price land on its exact cent
 * amount regardless.
 */
function toStartingPriceCents(startingPrice: number | null): number | null {
  return startingPrice != null ? Math.round(startingPrice * 100) : null;
}

/**
 * The inverse of toStartingPriceCents, for display: stored integer cents ->
 * "from €15.95 pp". Same formatting rule as formatCruiseMeta's price half
 * (EUR gets its symbol, any other currency keeps its code with a space,
 * whole-euro prices stay bare, fractional ones get two decimals) — kept as
 * its own function because this one starts from cents and is called from
 * guest-facing MapPin/BoatTour construction (toBoatTourView, getMapPins),
 * not from the BoatLocal feed's raw float.
 */
function formatStartingPriceCents(cents: number, currency: string): string {
  const amount = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  return currency === "EUR" ? `from €${amount} pp` : `from ${currency} ${amount} pp`;
}

/**
 * Upserts one cruise from BoatLocal's catalogue into `boat_tours`, keyed on
 * `fareharbor_pk` (falling back to `boatlocal_id` only if fareharbor_pk is
 * ever absent — per the confirmed schema it shouldn't be, but this is
 * cheap insurance against a single malformed feed entry, not a bet that it
 * will actually happen).
 *
 * NOTE / HEADLINE OWNERSHIP: BoatLocal's feed carries no guide-written
 * description, but it now DOES serve a one-line marketing `headline` per
 * cruise ("BYO Drinks Welcome • Small Group • Hidden Canal Routes" — all 61
 * current cruises have one). Every sync records the latest headline into
 * `boatlocal_headline` verbatim, and the guest-facing `note` is seeded from
 * it: on INSERT, `note` starts as a copy of the headline (or the old `""`
 * placeholder when BoatLocal has none). On UPDATE, the note is refreshed to
 * the latest headline ONLY while it is still "BoatLocal-owned" — i.e. the
 * current note is empty, equals the previously-recorded
 * `boatlocal_headline`, or equals the incoming headline itself. That last
 * comparison exists for the 2026-08-24 one-time backfill, which set
 * note = headline by hand before `boatlocal_headline` existed (so the stored
 * value is null there) — without it, every backfilled row would be mistaken
 * for admin copy forever. The moment an admin writes their own note in
 * BoatTourForm, it stops matching and is NEVER touched by a sync again,
 * exactly like every other admin-curated field. (Corollary judgment call: if
 * BoatLocal later drops a cruise's headline entirely, a still-unedited note
 * reverts to `""` and the row parks hidden again — the note was only ever a
 * copy of BoatLocal's own copy, so it follows BoatLocal's copy out.)
 *
 * The feed also sometimes carries real departure coordinates
 * (`cruise.departure` — lat/lng/address/source, confirmed shipping to
 * BoatLocal's staging first, not yet in their production feed as of this
 * comment) for most cruises, `null` for a small seasonal/candlelight subset
 * with neither a Google Maps link nor an address (~4 of 61 as of this
 * writing). On a genuinely NEW cruise (no existing row for this
 * fareharbor_pk yet): with a headline, the row arrives guest-ready and
 * `status` follows BoatLocal's `active` flag immediately; without one, it
 * inserts with `note: ""` and `status` forced to 'hidden' REGARDLESS of
 * BoatLocal's own `active` flag or whether real departure data is present —
 * **the founder's instruction that departure data alone must never
 * auto-publish still holds: it takes a real one-liner (BoatLocal's headline
 * or an admin's own note), not just coordinates, to go live.**
 * area/lng/lat are populated from `cruise.departure` when present
 * (address/lng/lat verbatim, `location_source` recording which of
 * `departure.source`'s confidence levels it came from) and left at the old
 * `""`/`0`/`0` placeholder — never geocoded or defaulted on Map App's own
 * side — when `departure` is `null`, exactly as before this field existed.
 * `active`/`fareharbor_pk`/`slug`/`boatlocal_id`/`cruise_type`/
 * `boatlocal_updated_at`/name/meta/photos/booking_url are all still recorded
 * immediately either way, so nothing about the cruise's identity is lost
 * while a headline-less cruise waits on that admin step.
 *
 * On every subsequent sync of an ALREADY-KNOWN fareharbor_pk, the
 * BoatLocal-owned fields above are re-written the same way (BoatLocal is the
 * source of truth for name/price/duration/photos/booking_url/active — a
 * price change on their side should propagate on the next sync).
 * area/lng/lat/position — and `note`, once an admin has customized it — are
 * Map App's own curation layer and are never touched here once real, exactly
 * like an admin-curated tour's fields never are. The ONE location exception:
 * while `area` is still the exact `""` placeholder this function itself
 * writes, a newly-available `cruise.departure` is backfilled into
 * area/lng/lat/location_source on the spot, so a cruise that synced before
 * BoatLocal had departure data to offer doesn't have to wait for an admin to
 * hand-enter coordinates BoatLocal can now supply automatically. This still
 * never publishes anything by itself — see the note-gate below.
 *
 * The "hidden pending completion" gate is STICKY, not one-time, and is keyed
 * off the EFFECTIVE note, NOT `area`: `status` is only driven by BoatLocal's
 * `active` flag while the row has a real one-liner to show a guest — an
 * admin-written note, or a BoatLocal headline standing in for one. Pending
 * completion now means "the note this sync leaves behind would still be
 * empty" (no admin note AND no headline), not merely `note === ""` on the
 * way in. The gate used to key off `area` instead, back when BoatLocal's
 * feed could never supply real location data at all — now that `departure`
 * often arrives automatically and correctly, an `area`-based gate would
 * incorrectly treat a freshly-synced cruise as "complete" the moment it
 * syncs. Without this check at all, the very next scheduled reconciliation
 * after a brand-new headline-less insert (which could run hours later, the
 * same day) would immediately flip an untouched row back to 'active' purely
 * because BoatLocal still reports it active, undoing the INSERT branch's
 * whole reason for existing. An empty note is a safe signal for "not yet
 * completed" only because this function is the one and only place that ever
 * writes that empty-string placeholder — a real admin-entered note is
 * validated non-empty by parseBoatTourForm.
 */
export async function syncCruiseFromBoatLocal(cruise: BoatLocalCruise): Promise<void> {
  const meta = formatCruiseMeta(cruise);
  // The structured counterparts of the `meta` line above (see the
  // 20260824020000_boat_tours_structured_meta.sql migration comment):
  // BoatLocal-owned like name/photos/booking_url, written on INSERT and
  // rewritten on EVERY update in both branches below, so a price or duration
  // change on their side propagates on the next sync. `meta` itself is
  // unchanged and still written alongside — it stays the composed display
  // fallback (and the only line an admin-curated tour has).
  const startingPriceCents = toStartingPriceCents(cruise.startingPrice);

  if (isTestEnv) {
    const existing =
      cruise.fareharborPk != null
        ? fakeStore.boatTours.find((t) => t.fareharborPk === cruise.fareharborPk)
        : fakeStore.boatTours.find((t) => t.boatlocalId === String(cruise.id));

    if (existing) {
      // NOTE OWNERSHIP (see this function's doc comment): the note is still
      // "BoatLocal-owned" — and therefore refreshed to the latest headline —
      // while it is empty, still equals the last headline a sync recorded
      // into boatlocalHeadline, or equals the incoming headline itself (the
      // one-time-backfill adoption case: note was hand-set to the headline
      // before boatlocal_headline existed, so the stored value is null
      // there). An admin's own note matches none of these and is never
      // touched.
      const noteIsBoatLocalOwned =
        existing.note === "" ||
        (existing.boatlocalHeadline !== null && existing.note === existing.boatlocalHeadline) ||
        (cruise.headline !== null && existing.note === cruise.headline);
      const note = noteIsBoatLocalOwned ? (cruise.headline ?? "") : existing.note;

      // STICKY SAFETY NET, keyed off the EFFECTIVE note this sync leaves
      // behind (not `area` — see this function's own doc comment for why
      // that changed): the row stays parked hidden while that note is still
      // empty, i.e. no admin note AND no headline. Without this check, the
      // very next scheduled reconciliation after a brand-new headline-less
      // insert would immediately flip a still-incomplete row back to
      // 'active' off of BoatLocal's own `active: true`, undoing the
      // "pending completion" gate the INSERT branch exists to enforce.
      const pendingCompletion = note === "";
      const status: BoatTourStatus = pendingCompletion ? "hidden" : cruise.active ? "active" : "hidden";

      Object.assign(existing, {
        name: cruise.name,
        meta,
        cruiseDuration: cruise.cruiseDuration,
        startingPriceCents,
        priceCurrency: cruise.currency,
        note,
        photos: cruise.images,
        bookingUrl: cruise.bookingUrl,
        boatlocalId: String(cruise.id),
        fareharborPk: cruise.fareharborPk,
        slug: cruise.slug,
        cruiseType: cruise.cruiseType,
        boatlocalActive: cruise.active,
        boatlocalHeadline: cruise.headline,
        status,
        deactivationReason: !pendingCompletion && cruise.active ? null : existing.deactivationReason,
        boatlocalUpdatedAt: cruise.updatedAt,
        updatedAt: new Date().toISOString(),
      });

      // Departure backfill: only while `area` is still the exact ""
      // placeholder this function writes on INSERT — the instant it's real
      // (admin-set or backfilled by an earlier sync), it's Map App's own
      // curation layer forever, same as every other manually-curated field
      // on this row. This intentionally does NOT require `pendingCompletion`
      // — the row may still be hidden pending a note, but there's no reason
      // to wait on that to also backfill accurate coordinates BoatLocal now
      // provides for free, and doing so here (rather than only at INSERT
      // time) is what lets a cruise that synced before `departure` existed
      // pick up real coordinates on its very next reconciliation.
      if (existing.area === "" && cruise.departure) {
        existing.area = cruise.departure.address;
        existing.lng = cruise.departure.lng;
        existing.lat = cruise.departure.lat;
        existing.locationSource = cruise.departure.source;
      }
      return;
    }

    const created = new Date().toISOString();
    const maxPosition = fakeStore.boatTours.reduce((max, t) => Math.max(max, t.position), 0);
    fakeStore.boatTours.push({
      id: fakeId("boat-tour"),
      name: cruise.name,
      area: cruise.departure?.address ?? "",
      lng: cruise.departure?.lng ?? 0,
      lat: cruise.departure?.lat ?? 0,
      meta,
      cruiseDuration: cruise.cruiseDuration,
      startingPriceCents,
      priceCurrency: cruise.currency,
      // A cruise with a headline arrives guest-ready: note starts as a copy
      // of it and status follows BoatLocal's active flag immediately. Without
      // one, the old behavior exactly: note "" and parked hidden pending
      // admin completion, regardless of BoatLocal's own active flag.
      note: cruise.headline ?? "",
      bookingUrl: cruise.bookingUrl,
      photos: cruise.images,
      position: maxPosition + 1,
      status: cruise.headline !== null ? (cruise.active ? "active" : "hidden") : "hidden",
      boatlocalId: String(cruise.id),
      fareharborPk: cruise.fareharborPk,
      slug: cruise.slug,
      cruiseType: cruise.cruiseType,
      boatlocalActive: cruise.active,
      boatlocalHeadline: cruise.headline,
      deactivationReason: null,
      boatlocalUpdatedAt: cruise.updatedAt,
      locationSource: cruise.departure?.source ?? null,
      createdAt: created,
      updatedAt: created,
    });
    return;
  }

  const supabase = await adminClient();
  const lookupColumn = cruise.fareharborPk != null ? "fareharbor_pk" : "boatlocal_id";
  const lookupValue: string | number =
    cruise.fareharborPk != null ? cruise.fareharborPk : String(cruise.id);

  const { data: existingData, error: fetchError } = await supabase
    .from("boat_tours")
    .select("id, area, note, boatlocal_headline, deactivation_reason")
    .eq(lookupColumn, lookupValue)
    .maybeSingle();
  if (fetchError) throw fetchError;
  const existing = existingData as
    | {
        id: string;
        area: string;
        note: string;
        boatlocal_headline: string | null;
        deactivation_reason: string | null;
      }
    | null;

  if (existing) {
    // See the isTestEnv branch above for the note-ownership rule and why the
    // completion gate is keyed off the effective note rather than `area`.
    const noteIsBoatLocalOwned =
      existing.note === "" ||
      (existing.boatlocal_headline !== null && existing.note === existing.boatlocal_headline) ||
      (cruise.headline !== null && existing.note === cruise.headline);
    const note = noteIsBoatLocalOwned ? (cruise.headline ?? "") : existing.note;
    const pendingCompletion = note === "";
    const status: BoatTourStatus = pendingCompletion ? "hidden" : cruise.active ? "active" : "hidden";

    const updates: Partial<BoatTourRow> = {
      name: cruise.name,
      meta,
      cruise_duration: cruise.cruiseDuration,
      starting_price_cents: startingPriceCents,
      price_currency: cruise.currency,
      note,
      photos: cruise.images,
      booking_url: cruise.bookingUrl,
      boatlocal_id: String(cruise.id),
      fareharbor_pk: cruise.fareharborPk,
      slug: cruise.slug,
      cruise_type: cruise.cruiseType,
      active: cruise.active,
      boatlocal_headline: cruise.headline,
      status,
      boatlocal_updated_at: cruise.updatedAt,
    };
    // A reactivation clears any stale reason — it can no longer apply.
    // Staying hidden keeps whatever reason (if any) is already on the row,
    // since this generic sync pass has no reason of its own to attach (only
    // the cruise.deactivated webhook / reconciliation's "missing from the
    // feed" path do — see deactivateBoatLocalCruise/hideMissingBoatLocalTours).
    if (!pendingCompletion && cruise.active) updates.deactivation_reason = null;

    // Departure backfill — see this function's own doc comment for why this
    // is independent of `pendingCompletion` and only ever fires once (area
    // stops being the "" placeholder the moment this runs).
    if (existing.area === "" && cruise.departure) {
      updates.area = cruise.departure.address;
      updates.lng = cruise.departure.lng;
      updates.lat = cruise.departure.lat;
      updates.location_source = cruise.departure.source;
    }

    const { error } = await supabase.from("boat_tours").update(updates).eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { data: maxRow, error: maxError } = await supabase
    .from("boat_tours")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxError) throw maxError;
  const maxPosition = (maxRow as Pick<BoatTourRow, "position"> | null)?.position ?? 0;

  const { error } = await supabase.from("boat_tours").insert({
    name: cruise.name,
    area: cruise.departure?.address ?? "",
    lng: cruise.departure?.lng ?? 0,
    lat: cruise.departure?.lat ?? 0,
    meta,
    cruise_duration: cruise.cruiseDuration,
    starting_price_cents: startingPriceCents,
    price_currency: cruise.currency,
    // See the isTestEnv branch above: a headline arrives guest-ready (note =
    // headline, status follows BoatLocal's active flag); no headline keeps
    // the old note-""/forced-hidden pending-completion behavior exactly.
    note: cruise.headline ?? "",
    booking_url: cruise.bookingUrl,
    photos: cruise.images,
    position: maxPosition + 1,
    status: cruise.headline !== null ? (cruise.active ? "active" : "hidden") : "hidden",
    boatlocal_id: String(cruise.id),
    fareharbor_pk: cruise.fareharborPk,
    slug: cruise.slug,
    cruise_type: cruise.cruiseType,
    active: cruise.active,
    boatlocal_headline: cruise.headline,
    deactivation_reason: null,
    boatlocal_updated_at: cruise.updatedAt,
    location_source: cruise.departure?.source ?? null,
  });
  if (error) throw error;
}

export interface CruiseDeactivatedIdentity {
  id: number;
  slug: string | null;
  fareharborPk: number | null;
}

/**
 * Hides one cruise by BoatLocal's own identity fields (from a
 * `cruise.deactivated` webhook — see src/lib/boatlocalCatalog.ts's
 * parseCruiseDeactivatedPayload) and records the reason as data. A cruise
 * we've never synced is a silent no-op, not an error — mirrors the booking
 * webhook's "unrecognised click id still gets a 200" philosophy: the event
 * genuinely happened, we just have no row to update.
 */
export async function deactivateBoatLocalCruise(
  identity: CruiseDeactivatedIdentity,
  reason: string | null,
): Promise<void> {
  if (isTestEnv) {
    const tour =
      identity.fareharborPk != null
        ? fakeStore.boatTours.find((t) => t.fareharborPk === identity.fareharborPk)
        : fakeStore.boatTours.find((t) => t.boatlocalId === String(identity.id));
    if (!tour) return;
    tour.status = "hidden";
    tour.deactivationReason = reason;
    tour.updatedAt = new Date().toISOString();
    return;
  }

  const supabase = await adminClient();
  const lookupColumn = identity.fareharborPk != null ? "fareharbor_pk" : "boatlocal_id";
  const lookupValue: string | number =
    identity.fareharborPk != null ? identity.fareharborPk : String(identity.id);

  const { error } = await supabase
    .from("boat_tours")
    .update({ status: "hidden", deactivation_reason: reason })
    .eq(lookupColumn, lookupValue);
  if (error) throw error;
}

/**
 * Hides every BoatLocal-sourced row (`fareharbor_pk is not null`) NOT among
 * `seenFareharborPks` — the "deactivate anything no longer returned" half of
 * reconciliation. Reason is recorded as "removed_from_fareharbor": absence
 * from a full catalogue re-fetch is exactly the automated-FareHarbor-sync
 * scenario the go-live plan itself calls out, as distinct from an explicit
 * `cruise.deactivated` webhook (which carries BoatLocal's own real reason
 * instead — see deactivateBoatLocalCruise above). Already-hidden rows are
 * left alone so the returned count reflects real state changes, not a
 * repeated no-op write.
 */
async function hideMissingBoatLocalTours(seenFareharborPks: Set<number>): Promise<number> {
  if (isTestEnv) {
    let count = 0;
    for (const tour of fakeStore.boatTours) {
      if (tour.fareharborPk != null && !seenFareharborPks.has(tour.fareharborPk) && tour.status !== "hidden") {
        tour.status = "hidden";
        tour.deactivationReason = "removed_from_fareharbor";
        tour.updatedAt = new Date().toISOString();
        count += 1;
      }
    }
    return count;
  }

  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("boat_tours")
    .select("id, fareharbor_pk")
    .not("fareharbor_pk", "is", null)
    .neq("status", "hidden");
  if (error) throw error;

  const rows = (data ?? []) as Array<{ id: string; fareharbor_pk: number }>;
  const toHide = rows.filter((r) => !seenFareharborPks.has(r.fareharbor_pk));
  if (toHide.length === 0) return 0;

  const { error: updateError } = await supabase
    .from("boat_tours")
    .update({ status: "hidden", deactivation_reason: "removed_from_fareharbor" })
    .in(
      "id",
      toHide.map((r) => r.id),
    );
  if (updateError) throw updateError;

  return toHide.length;
}

/** boatlocal.nl's public API host, overridable for a future staging/test target — same pattern the old NEXT_PUBLIC_BOOKING_BASE_URL used. */
function boatLocalApiBaseUrl(): string {
  return process.env.BOATLOCAL_CATALOG_BASE_URL || "https://boatlocal.nl";
}

export interface ReconcileBoatLocalCatalogResult {
  fetched: number;
  upserted: number;
  deactivated: number;
  error?: string;
}

/**
 * Re-pulls BoatLocal's FULL cruise catalogue and reconciles it against
 * `boat_tours` — "webhook-only sync always drifts eventually" is BoatLocal's
 * own guidance (docs/attribution.md), and correct, so this is the belt to
 * the boatlocal-cruise webhook's suspenders. Called once daily by
 * src/app/api/cron/sync-boat-tours/route.ts, and internally by nothing else
 * (the webhook handles single-cruise events itself via
 * syncCruiseFromBoatLocal/deactivateBoatLocalCruise directly).
 *
 * MUST NOT THROW: a network failure or non-2xx response is reported via the
 * `error` field, leaving every existing row untouched — a failed sync
 * attempt must never wipe out an already-working catalog. The same applies
 * if the response parses as JSON but yields zero usable cruises (either the
 * feed's shape drifted, or it genuinely returned an empty list) — that's
 * treated as a failed sync too, specifically so the "hide anything not
 * returned" step never runs against an empty or malformed result and hides
 * the entire real catalog on a fluke. This last guard is a judgment call:
 * the go-live plan doesn't say what a legitimately-empty catalogue should
 * do, and "do nothing rather than mass-deactivate" is the conservative
 * reading given the stated goal ("must never wipe out an already-working
 * catalog").
 */
export async function reconcileBoatLocalCatalog(): Promise<ReconcileBoatLocalCatalogResult> {
  let json: unknown;
  try {
    const res = await fetch(`${boatLocalApiBaseUrl()}/api/public/cruises`, { cache: "no-store" });
    if (!res.ok) {
      return { fetched: 0, upserted: 0, deactivated: 0, error: `catalogue fetch failed: HTTP ${res.status}` };
    }
    json = await res.json();
  } catch (err) {
    return {
      fetched: 0,
      upserted: 0,
      deactivated: 0,
      error: err instanceof Error ? err.message : "catalogue fetch threw a non-Error value",
    };
  }

  const rawCruises =
    typeof json === "object" && json !== null && Array.isArray((json as { cruises?: unknown }).cruises)
      ? ((json as { cruises: unknown[] }).cruises)
      : [];
  const cruises = rawCruises
    .map(parseBoatLocalCruise)
    .filter((c): c is BoatLocalCruise => c !== null);

  if (cruises.length === 0) {
    return {
      fetched: rawCruises.length,
      upserted: 0,
      deactivated: 0,
      error:
        rawCruises.length === 0
          ? "catalogue response contained no cruises — skipping deactivation to avoid wiping the catalog"
          : "no cruises parsed from the response — feed shape may have drifted",
    };
  }

  for (const cruise of cruises) {
    await syncCruiseFromBoatLocal(cruise);
  }

  const seenFareharborPks = new Set(
    cruises.map((c) => c.fareharborPk).filter((pk): pk is number => pk != null),
  );
  const deactivated = await hideMissingBoatLocalTours(seenFareharborPks);

  return { fetched: cruises.length, upserted: cruises.length, deactivated };
}

// =============================================================================
// Studio reads/writes (authenticated — role-gated by StudioActor, mirroring
// the RLS policies in 20260805063611_rls_policies.sql).
// =============================================================================

function assertCompanyScope(actor: StudioActor, companyId: string): void {
  if (actor.role === "admin") return;
  if (actor.companyId !== companyId) {
    throw new StudioPermissionError(
      `Actor (role=${actor.role}, companyId=${actor.companyId}) may not access company ${companyId}.`,
    );
  }
}

/**
 * Recommendations visible to this actor in Studio: admin sees all
 * (including every tenant's admin-owned rows — this is Admin's own internal
 * "everything" read, not a Studio surface; see getAdminRecommendationsForCompany
 * for the one-company, admin-owned-only equivalent Admin's UI actually
 * uses), a company sees every row under its own tenant EXCEPT admin-owned
 * ones (base list + every guide's items, for dashboards), a guide sees the
 * base list read-only plus their own items — never another guide's items,
 * never another tenant's rows, and never an admin-owned row either.
 *
 * owner_type='admin' rows are the one deliberate exception to "a company
 * sees everything under its own tenant": those rows must stay invisible to
 * that company's own Studio dashboard by design (see
 * supabase/migrations/20260824090100_admin_recommendations_rls.sql's
 * header). The `owner_type <> 'admin'` filter below is DEFENSE IN DEPTH on
 * top of that RLS change, matching this file's own "every layer re-checks"
 * pattern (see assertAdmin and its callers) — company_select_own_tenant
 * already enforces this server-side for the real backend, and the guide
 * branch's own condition already never matches an admin-owned row for a
 * structural reason (guide_id is null on one, non-null on the actor), not
 * because of this added clause, but the clause is kept anyway so this
 * function's behaviour doesn't silently depend on that being true forever.
 *
 * Real backend: authed client. Admin: unfiltered select (admin_full_access
 * does the rest). Company/guide: `.eq('company_id', actor.companyId)` plus
 * an explicit `.neq('owner_type', 'admin')` — RLS (company_select_own_tenant
 * / guide_select_base_and_own) narrows a guide's rows to base-list+own and
 * excludes admin-owned rows from a company's own tenant server-side too, so
 * this client-side filter is redundant against a correctly-configured RLS
 * policy, which is the correct direction to be redundant in (the fakeStore
 * branch below keeps its own in-code filtering, which is the ONLY
 * enforcement in tests, since fakeStore has no RLS of its own).
 */
export async function getRecommendationsForStudio(
  actor: StudioActor,
): Promise<RecommendationRecord[]> {
  if (isTestEnv) {
    if (actor.role === "admin") return [...fakeStore.recommendations];

    if (actor.role === "company") {
      return fakeStore.recommendations.filter(
        (r) => r.companyId === actor.companyId && r.ownerType !== "admin",
      );
    }

    // guide
    return fakeStore.recommendations.filter(
      (r) =>
        r.companyId === actor.companyId &&
        r.ownerType !== "admin" &&
        (r.ownerType === "company" || r.guideId === actor.guideId),
    );
  }

  const supabase = await authedClient();
  let query = supabase.from("recommendations").select("*");
  if (actor.role !== "admin") {
    query = query.eq("company_id", actor.companyId).neq("owner_type", "admin");
  }
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as RecommendationRow[]).map(fromRecommendationRow);
}

/**
 * Admin's own read for its company-scoped curated recommendations — the
 * ONLY listing Admin's UI (the new "Admin recommendations for {company}"
 * section on the company detail page) actually uses, as opposed to
 * getRecommendationsForStudio(ADMIN_ACTOR) above, which returns EVERY
 * tenant's EVERY row (all owner types) and is Studio-shaped, not what a
 * one-company admin-curated list needs. Admin-only: a company/guide actor
 * has no legitimate reason to call this (it would defeat the entire point
 * of these rows being invisible to them), so it's refused before any query,
 * same pattern as assertAdmin's other callers.
 */
export async function getAdminRecommendationsForCompany(
  actor: StudioActor,
  companyId: string,
): Promise<RecommendationRecord[]> {
  assertAdmin(actor, "view a company's admin-curated recommendations");

  if (isTestEnv) {
    return fakeStore.recommendations.filter(
      (r) => r.companyId === companyId && r.ownerType === "admin",
    );
  }

  const supabase = await authedClient();
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .eq("company_id", companyId)
    .eq("owner_type", "admin");
  if (error) throw error;
  return ((data ?? []) as RecommendationRow[]).map(fromRecommendationRow);
}

/**
 * Creates or updates a recommendation. A company may only write base-list
 * rows (ownerType "company") in its own tenant; a guide may only write
 * their own rows; admin may only write admin-owned rows (ownerType "admin"),
 * scoped to whichever company `input.companyId` names — never a company's or
 * guide's own tenant content. Mirrors company_manage_base_list /
 * guide_manage_own_items / (for the admin case) the CHECK constraint added
 * by 20260824090100_admin_recommendations_rls.sql, since there is no
 * separate `admin_manage_own_items`-style RLS policy — admin_full_access
 * already grants admin unrestricted CRUD on this table, so THIS function's
 * own admin.role branch below is the only thing stopping admin from writing
 * a company's or guide's row through this call — a real business rule
 * ("admin only ever owns the new admin-curated lane, nothing else"), not
 * just RLS-mirroring.
 *
 * Real backend: authed client. The admin-requires-companyId check and the
 * boats-category refusal are both applied before any query. For an edit,
 * the existing row is fetched first (via the same authed client, so RLS
 * narrows what an actor can even see) to reproduce the exact ownership
 * check the fakeStore branch makes — this is also where a company/guide
 * actor's attempt to edit an admin-owned row gets refused: `existing
 * .owner_type === ownerType` can never be true when `ownerType` is
 * "company"/"guide" and the existing row's owner_type is "admin", so that
 * case already falls into the same StudioPermissionError this whole check
 * throws for any other ownership mismatch — belt and suspenders on top of
 * RLS (company_update_base_list / guide_update_own_items each hard-require
 * their own owner_type already, so RLS would refuse the same write too, but
 * this app-layer check runs and throws first, without ever reaching the
 * database, in fakeStore's test-mode branch where RLS doesn't exist at
 * all). If RLS itself already hides the row from this actor (e.g. a guide
 * targeting another guide's item), that fetch returns null and this throws
 * the same StudioPermissionError a mismatched-but-visible row would — see
 * file-level note on deleteRecommendation for the one case where this can't
 * be reproduced identically.
 */
export async function saveRecommendation(
  actor: StudioActor,
  input: SaveRecommendationInput,
): Promise<RecommendationRecord> {
  if (actor.role === "admin" && !input.companyId) {
    throw new StudioPermissionError(
      "Admin must specify which company an admin-curated recommendation belongs to.",
    );
  }
  if (input.categories.length === 0) {
    // Enforced at the DB layer too (recommendation_categories_not_empty CHECK).
    throw new StudioPermissionError("Choose at least one category.");
  }
  if (input.categories.includes("boats")) {
    // Enforced at the DB layer too (recommendation_categories_not_boats CHECK).
    throw new StudioPermissionError("Boat tours are a separate table, never a recommendation.");
  }

  // Admin has no companyId of its own on the actor (unlike "company"/
  // "guide"); an admin-owned row instead takes it from the input, which the
  // check above already guarantees is present by this point.
  const companyId = actor.role === "admin" ? (input.companyId as string) : actor.companyId;
  const ownerType = actor.role;
  const guideId = actor.role === "guide" ? actor.guideId : null;

  if (isTestEnv) {
    if (input.id) {
      const existing = fakeStore.recommendations.find((r) => r.id === input.id);
      if (
        !existing ||
        existing.companyId !== companyId ||
        existing.ownerType !== ownerType ||
        (ownerType === "guide" && existing.guideId !== guideId)
      ) {
        throw new StudioPermissionError(`Actor may not edit recommendation ${input.id}.`);
      }
      Object.assign(existing, {
        categories: input.categories,
        name: input.name,
        area: input.area,
        address: input.address,
        lng: input.lng,
        lat: input.lat,
        note: input.note,
        hours: input.hours,
        photos: input.photos,
        visible: input.visible ?? existing.visible,
        // Preserve an existing Google snapshot unless the caller explicitly
        // sends a new one — the ordinary edit form has no rating field at
        // all, and undefined here must never silently null out a rating a
        // Google-enriched add already captured.
        googleRating: input.googleRating !== undefined ? input.googleRating : existing.googleRating,
        googleReviewCount:
          input.googleReviewCount !== undefined
            ? input.googleReviewCount
            : existing.googleReviewCount,
        updatedAt: new Date().toISOString(),
      });
      return existing;
    }

    const created = new Date().toISOString();
    const record: RecommendationRecord = {
      id: fakeId("recommendation"),
      companyId,
      ownerType,
      guideId,
      categories: input.categories,
      name: input.name,
      area: input.area,
      address: input.address,
      lng: input.lng,
      lat: input.lat,
      note: input.note,
      hours: input.hours,
      photos: input.photos,
      visible: input.visible ?? true,
      googleRating: input.googleRating ?? null,
      googleReviewCount: input.googleReviewCount ?? null,
      createdBy: null,
      createdAt: created,
      updatedAt: created,
    };
    fakeStore.recommendations.push(record);
    return record;
  }

  const supabase = await authedClient();

  if (input.id) {
    const { data: existingData, error: fetchError } = await supabase
      .from("recommendations")
      .select("*")
      .eq("id", input.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    const existing = existingData as RecommendationRow | null;
    const allowed =
      !!existing &&
      existing.company_id === companyId &&
      existing.owner_type === ownerType &&
      (ownerType !== "guide" || existing.guide_id === guideId);
    if (!allowed) {
      throw new StudioPermissionError(`Actor may not edit recommendation ${input.id}.`);
    }

    const { data, error } = await supabase
      .from("recommendations")
      .update({
        categories: input.categories,
        name: input.name,
        area: input.area,
        address: input.address,
        lng: input.lng,
        lat: input.lat,
        note: input.note,
        hours: input.hours,
        photos: input.photos,
        visible: input.visible ?? existing.visible,
        // Same "don't clobber an unrelated snapshot" rule as the fakeStore
        // branch above.
        google_rating: input.googleRating !== undefined ? input.googleRating : existing.google_rating,
        google_review_count:
          input.googleReviewCount !== undefined
            ? input.googleReviewCount
            : existing.google_review_count,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    return fromRecommendationRow(data as RecommendationRow);
  }

  // createdBy is left unset (null): actor is not threaded with the real
  // auth.uid() of the signed-in user at this layer, only role/companyId/
  // guideId — matches the fakeStore branch's `createdBy: null` exactly, but
  // is a real (documented) gap versus what the schema allows for once a
  // caller's auth user id is available here.
  const { data, error } = await supabase
    .from("recommendations")
    .insert({
      company_id: companyId,
      owner_type: ownerType,
      guide_id: guideId,
      categories: input.categories,
      name: input.name,
      area: input.area,
      address: input.address,
      lng: input.lng,
      lat: input.lat,
      note: input.note,
      hours: input.hours,
      photos: input.photos,
      visible: input.visible ?? true,
      google_rating: input.googleRating ?? null,
      google_review_count: input.googleReviewCount ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return fromRecommendationRow(data as RecommendationRow);
}

/**
 * Real backend: authed client. Admin may delete ANY recommendation
 * regardless of owner_type (including its own admin-owned rows) — this
 * mirrors admin_full_access exactly and is intentionally broader than
 * saveRecommendation's admin rule (which confines admin to only ever
 * CREATING/EDITING its own admin-owned lane). A company/guide actor's
 * `allowed` check below already requires `owner_type === 'company'` /
 * `'guide'` respectively, which an admin-owned row (owner_type='admin') can
 * never satisfy — so an attempt to delete an admin-owned row as a company
 * or guide actor throws the same StudioPermissionError as any other
 * ownership mismatch, before the DELETE is ever issued. Belt and suspenders
 * on top of RLS (whose own company_delete_base_list/guide_delete_own_items
 * policies hard-require the same owner_type and would refuse it too), and
 * the ONLY enforcement at all in fakeStore's test-mode branch below, which
 * has no RLS to fall back on.
 *
 * See saveRecommendation's comment on why the existing row is fetched
 * first. DOCUMENTED BEHAVIOUR DIFFERENCE: if the actor cannot even SELECT
 * the target row under RLS (e.g. a guide targeting another guide's item, or
 * any actor targeting a row outside their tenant),
 * the fetch returns null and this function no-ops silently — exactly like
 * "not found" — instead of throwing StudioPermissionError the way the
 * fakeStore branch does (which has no RLS, so it always finds the row and
 * always reaches the explicit ownership check). This matches the same
 * "non-admin caller simply sees nothing" pattern this file's own mapping
 * already documents as acceptable for the analytics RPCs; it is not
 * reproduced identically because doing so would require bypassing RLS with
 * the service-role client for a routine tenant-scoped delete, which the
 * setup rules explicitly say to avoid.
 */
export async function deleteRecommendation(actor: StudioActor, id: string): Promise<void> {
  if (isTestEnv) {
    const idx = fakeStore.recommendations.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const rec = fakeStore.recommendations[idx];

    const allowed =
      actor.role === "admin" ||
      (actor.role === "company" &&
        rec.companyId === actor.companyId &&
        rec.ownerType === "company") ||
      (actor.role === "guide" &&
        rec.companyId === actor.companyId &&
        rec.ownerType === "guide" &&
        rec.guideId === actor.guideId);

    if (!allowed) {
      throw new StudioPermissionError(`Actor may not delete recommendation ${id}.`);
    }
    fakeStore.recommendations.splice(idx, 1);
    return;
  }

  const supabase = await authedClient();
  const { data: existingData, error: fetchError } = await supabase
    .from("recommendations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  const existing = existingData as RecommendationRow | null;
  if (!existing) return;

  const allowed =
    actor.role === "admin" ||
    (actor.role === "company" &&
      existing.company_id === actor.companyId &&
      existing.owner_type === "company") ||
    (actor.role === "guide" &&
      existing.company_id === actor.companyId &&
      existing.owner_type === "guide" &&
      existing.guide_id === actor.guideId);

  if (!allowed) {
    throw new StudioPermissionError(`Actor may not delete recommendation ${id}.`);
  }
  const { error } = await supabase.from("recommendations").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Flips one recommendation's `visible` flag on its own — what the quick
 * toggle in the Studio Recommendations table calls, so a guide can pull a
 * place off their map without opening (and re-submitting) the whole edit
 * form. Deliberately NOT expressed as a saveRecommendation() call with a
 * spread-in record: that would round-trip every other field through the
 * client and let a stale form silently overwrite a concurrent edit, where
 * this touches exactly the one column it names.
 *
 * Permission rules — and the documented RLS-vs-fakeStore behaviour
 * difference when the actor cannot even SELECT the row — are identical to
 * deleteRecommendation's directly above; see its comment rather than
 * duplicating the reasoning here.
 */
export async function setRecommendationVisibility(
  actor: StudioActor,
  id: string,
  visible: boolean,
): Promise<void> {
  if (isTestEnv) {
    const rec = fakeStore.recommendations.find((r) => r.id === id);
    if (!rec) return;

    const allowed =
      actor.role === "admin" ||
      (actor.role === "company" &&
        rec.companyId === actor.companyId &&
        rec.ownerType === "company") ||
      (actor.role === "guide" &&
        rec.companyId === actor.companyId &&
        rec.ownerType === "guide" &&
        rec.guideId === actor.guideId);

    if (!allowed) {
      throw new StudioPermissionError(`Actor may not edit recommendation ${id}.`);
    }
    rec.visible = visible;
    rec.updatedAt = new Date().toISOString();
    return;
  }

  const supabase = await authedClient();
  const { data: existingData, error: fetchError } = await supabase
    .from("recommendations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  const existing = existingData as RecommendationRow | null;
  if (!existing) return;

  const allowed =
    actor.role === "admin" ||
    (actor.role === "company" &&
      existing.company_id === actor.companyId &&
      existing.owner_type === "company") ||
    (actor.role === "guide" &&
      existing.company_id === actor.companyId &&
      existing.owner_type === "guide" &&
      existing.guide_id === actor.guideId);

  if (!allowed) {
    throw new StudioPermissionError(`Actor may not edit recommendation ${id}.`);
  }

  const { error } = await supabase
    .from("recommendations")
    .update({ visible })
    .eq("id", id);
  if (error) throw error;
}


/**
 * Guides belonging to a company (Studio "Guides" tab, PRD §7.3). Admin may
 * pass any companyId; company/guide are restricted to their own.
 *
 * Real backend: authed client, plain select. NOTE (flagged for the
 * Studio-auth builder/QA, per this file's own mapping): there is no RLS
 * policy letting a guide see the *whole* company guide list — only
 * guide_select_self (own row). A guide-actor call to this function will be
 * silently narrowed by RLS to exactly one row (their own), unlike the
 * fakeStore branch, which (matching the in-code assertCompanyScope) returns
 * every guide in the company. The one real caller today
 * (src/app/studio/(protected)/profile/page.tsx) does
 * `guides.find(g => g.id === session.guideId)`, which still finds the now-
 * single row correctly, but nobody should assume "full company guide list"
 * from a guide-actor call to this function against the real backend.
 */
export async function getGuidesForCompany(
  actor: StudioActor,
  companyId: string,
): Promise<GuideRecord[]> {
  assertCompanyScope(actor, companyId);

  if (isTestEnv) {
    return fakeStore.guides.filter((g) => g.companyId === companyId);
  }

  const supabase = await authedClient();
  const { data, error } = await supabase.from("guides").select("*").eq("company_id", companyId);
  if (error) throw error;
  return ((data ?? []) as GuideRow[]).map(fromGuideRow);
}

/**
 * Generates a unique invite token. "inv_" prefix mirrors createClickId's
 * "bkl_" convention in src/lib/attribution.ts — visually distinguishable in
 * logs, not a security property.
 */
function generateInviteToken(): string {
  const raw =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `inv_${raw.replace(/-/g, "")}`;
}

/**
 * Invites a new guide into a company (Studio "Guides" tab, PRD §7.3):
 * creates the guide row up front (status "invited") with a fresh
 * unique-per-company slug and a unique invite token, so the invite link is
 * real and immediately shareable (see src/app/join/[token]/page.tsx and its
 * own header comment for what redeeming it should eventually do). Company
 * (or admin) only — mirrors company_manage_own_guides; a guide cannot invite
 * another guide (no insert policy on guides for guide at all — enforced
 * twice).
 *
 * Real backend: authed client.
 */
export async function inviteGuide(
  actor: StudioActor,
  companyId: string,
  input: InviteGuideInput,
): Promise<GuideRecord> {
  if (actor.role !== "company" && actor.role !== "admin") {
    throw new StudioPermissionError("Only a company (or admin) may invite guides.");
  }
  assertCompanyScope(actor, companyId);

  if (isTestEnv) {
    const existingSlugs = fakeStore.guides
      .filter((g) => g.companyId === companyId)
      .map((g) => g.slug);
    const created = new Date().toISOString();
    const record: GuideRecord = {
      id: fakeId("guide"),
      companyId,
      name: input.name,
      email: input.email,
      slug: uniqueSlug(input.name, existingSlugs),
      avatarUrl: null,
      avatarInitial: initialFromName(input.name),
      welcomeMessage: "",
      status: "invited",
      inviteToken: generateInviteToken(),
      createdAt: created,
      updatedAt: created,
    };
    fakeStore.guides.push(record);
    return record;
  }

  const supabase = await authedClient();
  const { data: existingGuides, error: fetchError } = await supabase
    .from("guides")
    .select("slug")
    .eq("company_id", companyId);
  if (fetchError) throw fetchError;
  const existingSlugs = ((existingGuides ?? []) as Array<Pick<GuideRow, "slug">>).map(
    (g) => g.slug,
  );

  const { data, error } = await supabase
    .from("guides")
    .insert({
      company_id: companyId,
      name: input.name,
      email: input.email,
      slug: uniqueSlug(input.name, existingSlugs),
      avatar_initial: initialFromName(input.name),
      welcome_message: "",
      status: "invited",
      invite_token: generateInviteToken(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return fromGuideRow(data as GuideRow);
}

/**
 * Sets a guide's status (Studio "Guides" tab deactivate/reactivate, PRD
 * §7.3). Company (or admin) only — a guide cannot deactivate themself (or
 * anyone else) through this path. Clears the invite token once a guide
 * leaves "invited", since nothing should still be able to redeem it.
 *
 * RISK, not just redundancy (per this file's own mapping): RLS's
 * guide_update_self has no column restriction, so a guide's own
 * authenticated session could technically also satisfy the same UPDATE
 * policy on `status`/`invite_token` if any client code ever called a
 * generic "update guide" path directly with a guide session. The role
 * check below — which runs and can throw BEFORE any Supabase call is ever
 * made — is the ONLY thing preventing that; it must never be bypassed by
 * exposing this to guide sessions.
 */
export async function setGuideStatus(
  actor: StudioActor,
  guideId: string,
  status: GuideStatus,
): Promise<GuideRecord> {
  if (actor.role !== "company" && actor.role !== "admin") {
    throw new StudioPermissionError("Only a company (or admin) may change a guide's status.");
  }

  if (isTestEnv) {
    const guide = fakeStore.guides.find((g) => g.id === guideId);
    if (!guide) throw new StudioPermissionError(`Guide ${guideId} not found.`);
    assertCompanyScope(actor, guide.companyId);

    guide.status = status;
    if (status !== "invited") guide.inviteToken = null;
    guide.updatedAt = new Date().toISOString();
    return guide;
  }

  const supabase = await authedClient();
  const { data: existingData, error: fetchError } = await supabase
    .from("guides")
    .select("*")
    .eq("id", guideId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  const existing = existingData as GuideRow | null;
  if (!existing) throw new StudioPermissionError(`Guide ${guideId} not found.`);
  assertCompanyScope(actor, existing.company_id);

  const { data, error } = await supabase
    .from("guides")
    .update({
      status,
      invite_token: status === "invited" ? existing.invite_token : null,
    })
    .eq("id", guideId)
    .select("*")
    .single();
  if (error) throw error;
  return fromGuideRow(data as GuideRow);
}

/** Convenience wrapper over setGuideStatus for the Guides page's "Deactivate" action. */
export async function deactivateGuide(actor: StudioActor, guideId: string): Promise<GuideRecord> {
  return setGuideStatus(actor, guideId, "deactivated");
}

/** Convenience wrapper over setGuideStatus for the Guides page's "Reactivate" action. */
export async function reactivateGuide(actor: StudioActor, guideId: string): Promise<GuideRecord> {
  return setGuideStatus(actor, guideId, "active");
}

/**
 * A guide editing their own profile (PRD §6.2: photo + welcome message).
 * Guide-self only (or admin, for support purposes) — deliberately NOT
 * company: a guide's welcome message is their own voice, not something the
 * company edits on their behalf.
 *
 * Real backend: authed client. Guards against an empty update payload (both
 * input fields omitted) — PostgREST can't translate a zero-column PATCH
 * into valid SQL, so that case fetches and returns the current row instead
 * of issuing a no-op update.
 */
export async function updateGuideProfile(
  actor: StudioActor,
  guideId: string,
  input: UpdateGuideProfileInput,
): Promise<GuideRecord> {
  const allowed =
    actor.role === "admin" || (actor.role === "guide" && actor.guideId === guideId);
  if (!allowed) {
    throw new StudioPermissionError(`Actor may not edit guide ${guideId}'s profile.`);
  }

  if (isTestEnv) {
    const guide = fakeStore.guides.find((g) => g.id === guideId);
    if (!guide) throw new StudioPermissionError(`Guide ${guideId} not found.`);

    if (input.avatarUrl !== undefined) guide.avatarUrl = input.avatarUrl;
    if (input.welcomeMessage !== undefined) guide.welcomeMessage = input.welcomeMessage;
    guide.updatedAt = new Date().toISOString();
    return guide;
  }

  const supabase = await authedClient();
  const updates: Partial<Pick<GuideRow, "avatar_url" | "welcome_message">> = {};
  if (input.avatarUrl !== undefined) updates.avatar_url = input.avatarUrl;
  if (input.welcomeMessage !== undefined) updates.welcome_message = input.welcomeMessage;

  if (Object.keys(updates).length === 0) {
    const { data, error } = await supabase
      .from("guides")
      .select("*")
      .eq("id", guideId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new StudioPermissionError(`Guide ${guideId} not found.`);
    return fromGuideRow(data as GuideRow);
  }

  const { data, error } = await supabase
    .from("guides")
    .update(updates)
    .eq("id", guideId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new StudioPermissionError(`Guide ${guideId} not found.`);
  return fromGuideRow(data as GuideRow);
}

/** Admin-owned boat tour catalog (PRD §8.2) plus this tenant's featured flag, for the company's "Boat tours" tab (PRD §7.5). */
export async function getBoatCatalogForStudio(
  actor: StudioActor,
): Promise<Array<BoatTourRecord & { isFeatured: boolean; featuredPosition: number }>> {
  if (isTestEnv) {
    const companyId = actor.role === "admin" ? null : actor.companyId;
    return fakeStore.boatTours
      .map((tour) => {
        const feature = companyId
          ? fakeStore.companyBoatFeatures.find(
              (f) => f.boatTourId === tour.id && f.companyId === companyId,
            )
          : undefined;
        return {
          ...tour,
          isFeatured: feature?.isFeatured ?? false,
          featuredPosition: feature?.position ?? tour.position,
        };
      })
      .sort((a, b) => a.position - b.position);
  }

  const supabase = await authedClient();
  const { data: toursData, error: toursError } = await supabase
    .from("boat_tours")
    .select("*")
    .order("position");
  if (toursError) throw toursError;
  const tours = (toursData ?? []) as BoatTourRow[];

  let features: CompanyBoatFeatureRow[] = [];
  if (actor.role !== "admin") {
    const { data: featuresData, error: featuresError } = await supabase
      .from("company_boat_features")
      .select("*")
      .eq("company_id", actor.companyId);
    if (featuresError) throw featuresError;
    features = (featuresData ?? []) as CompanyBoatFeatureRow[];
  }
  const featureMap = new Map(features.map((f) => [f.boat_tour_id, f]));

  return tours.map((tour) => {
    const feature = featureMap.get(tour.id);
    const record = fromBoatTourRow(tour);
    return {
      ...record,
      isFeatured: feature?.is_featured ?? false,
      featuredPosition: feature?.position ?? record.position,
    };
  });
}

/**
 * Toggles/reorders a featured boat tour. Company-only (a guide sees this
 * list read-only per PRD §6.4).
 *
 * Real backend: authed client, upsert on (company_id, boat_tour_id). When
 * no position is given and no row exists yet, defaults to 0 (matches the
 * fakeStore branch); when no position is given and a row already exists,
 * its current position is preserved rather than reset to 0.
 */
export async function setBoatFeature(
  actor: StudioActor,
  boatTourId: string,
  isFeatured: boolean,
  position?: number,
): Promise<void> {
  if (actor.role !== "company" && actor.role !== "admin") {
    throw new StudioPermissionError("Only a company (or admin) may change featured boat tours.");
  }
  const companyId = actor.role === "admin" ? undefined : actor.companyId;
  if (!companyId) {
    throw new StudioPermissionError("setBoatFeature requires a company-scoped actor.");
  }

  if (isTestEnv) {
    const existing = fakeStore.companyBoatFeatures.find(
      (f) => f.companyId === companyId && f.boatTourId === boatTourId,
    );
    if (existing) {
      existing.isFeatured = isFeatured;
      if (position != null) existing.position = position;
      return;
    }
    fakeStore.companyBoatFeatures.push({
      companyId,
      boatTourId,
      isFeatured,
      position: position ?? 0,
      createdAt: new Date().toISOString(),
    });
    return;
  }

  const supabase = await authedClient();
  const { data: existingData, error: fetchError } = await supabase
    .from("company_boat_features")
    .select("*")
    .eq("company_id", companyId)
    .eq("boat_tour_id", boatTourId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  const existing = existingData as CompanyBoatFeatureRow | null;

  const { error } = await supabase.from("company_boat_features").upsert(
    {
      company_id: companyId,
      boat_tour_id: boatTourId,
      is_featured: isFeatured,
      position: position ?? existing?.position ?? 0,
    },
    { onConflict: "company_id,boat_tour_id" },
  );
  if (error) throw error;
}

/** Full company row for Studio's Branding tab (PRD §7.2). */
export async function getCompanyForStudio(
  actor: StudioActor,
  companyId: string,
): Promise<CompanyRecord | null> {
  assertCompanyScope(actor, companyId);

  if (isTestEnv) {
    return fakeStore.companies.find((c) => c.id === companyId) ?? null;
  }

  const supabase = await authedClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw error;
  return data ? fromCompanyRow(data as CompanyRow) : null;
}

export interface UpdateCompanyBrandingInput {
  appName?: string;
  brandPrimary?: string;
  brandPrimaryDark?: string;
  brandAccent?: string;
  brandSurround?: string;
  logoUrl?: string | null;
  campaignParams?: string | null;
  googleReviewUrl?: string | null;
  tripadvisorReviewUrl?: string | null;
  reviewPlatform?: "google" | "tripadvisor";
}

/**
 * Real backend: authed client. Guards against an empty update payload the
 * same way updateGuideProfile does, for the same PostgREST reason.
 */
export async function updateCompanyBranding(
  actor: StudioActor,
  companyId: string,
  input: UpdateCompanyBrandingInput,
): Promise<CompanyRecord> {
  if (actor.role !== "company" && actor.role !== "admin") {
    throw new StudioPermissionError("Only a company (or admin) may edit branding.");
  }
  assertCompanyScope(actor, companyId);

  if (isTestEnv) {
    const company = fakeStore.companies.find((c) => c.id === companyId);
    if (!company) throw new StudioPermissionError(`Company ${companyId} not found.`);

    Object.assign(company, input, { updatedAt: new Date().toISOString() });
    return company;
  }

  const supabase = await authedClient();
  const updates: Partial<CompanyRow> = {};
  if (input.appName !== undefined) updates.app_name = input.appName;
  if (input.brandPrimary !== undefined) updates.brand_primary = input.brandPrimary;
  if (input.brandPrimaryDark !== undefined) updates.brand_primary_dark = input.brandPrimaryDark;
  if (input.brandAccent !== undefined) updates.brand_accent = input.brandAccent;
  if (input.brandSurround !== undefined) updates.brand_surround = input.brandSurround;
  if (input.logoUrl !== undefined) updates.logo_url = input.logoUrl;
  if (input.campaignParams !== undefined) updates.campaign_params = input.campaignParams;
  if (input.googleReviewUrl !== undefined) updates.google_review_url = input.googleReviewUrl;
  if (input.tripadvisorReviewUrl !== undefined) {
    updates.tripadvisor_review_url = input.tripadvisorReviewUrl;
  }
  if (input.reviewPlatform !== undefined) updates.review_platform = input.reviewPlatform;

  if (Object.keys(updates).length === 0) {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new StudioPermissionError(`Company ${companyId} not found.`);
    return fromCompanyRow(data as CompanyRow);
  }

  const { data, error } = await supabase
    .from("companies")
    .update(updates)
    .eq("id", companyId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new StudioPermissionError(`Company ${companyId} not found.`);
  return fromCompanyRow(data as CompanyRow);
}

// =============================================================================
// Analytics rollups (PRD §6.4, §7.1, §7.7, §8.4).
// =============================================================================

function inRange(occurredAt: string, range?: AnalyticsRange): boolean {
  if (!range) return true;
  const t = new Date(occurredAt).getTime();
  return t >= range.from.getTime() && t < range.to.getTime();
}

function rangeParams(range?: AnalyticsRange): { p_from?: string; p_to?: string } {
  return range ? { p_from: range.from.toISOString(), p_to: range.to.toISOString() } : {};
}

/**
 * The fakeStore-side mirror of 20260823210000_net_cancelled_booking_outcomes.sql's
 * SQL netting: a `booking_outcome` event contributes -1 when it's a
 * cancellation, +1 otherwise (confirmed), so a confirmed+cancelled pair for
 * the same booking sums to zero instead of the cancellation inflating the
 * count. Every other event type is a plain +1. This has to be duplicated
 * here (not just fixed once in the real RPCs) because the fakeStore branch
 * is exercised by `npx vitest run` and has no SQL of its own to fall back
 * on — see this file's header comment on why the fakeStore branch is not
 * optional scaffolding.
 */
function bookingOutcomeIncrement(event: EventRecord): number {
  if (event.eventType !== "booking_outcome") return 1;
  return event.metadata?.event === "booking.cancelled" ? -1 : 1;
}

/** Real backend: authed client, RPC `company_analytics_summary`. */
export async function getCompanyAnalyticsSummary(
  actor: StudioActor,
  companyId: string,
  range?: AnalyticsRange,
): Promise<AnalyticsSummaryRow[]> {
  assertCompanyScope(actor, companyId);

  if (isTestEnv) {
    const counts = new Map<string, AnalyticsSummaryRow>();
    for (const e of fakeStore.events) {
      if (e.companyId !== companyId || !inRange(e.occurredAt, range)) continue;
      // Booking financial/outcome data is admin-only (RLS:
      // company_select_own_events excludes event_type='booking_outcome' —
      // see 20260823220000_restrict_booking_outcome_events_rls.sql). The
      // fakeStore branch has no RLS of its own, so this mirrors that
      // exclusion by hand for a non-admin actor.
      if (e.eventType === "booking_outcome" && actor.role !== "admin") continue;
      // Test/staging-originated rows never count toward real numbers — see
      // 20260823240000_events_is_test_tag.sql's matching RPC exclusion.
      if (e.isTest) continue;
      const key = `${e.eventType}::${e.guideId ?? ""}`;
      const row = counts.get(key) ?? { eventType: e.eventType, guideId: e.guideId, count: 0 };
      row.count += bookingOutcomeIncrement(e);
      counts.set(key, row);
    }
    return [...counts.values()];
  }

  const supabase = await authedClient();
  const { data, error } = await supabase.rpc("company_analytics_summary", {
    p_company_id: companyId,
    ...rangeParams(range),
  });
  if (error) throw error;
  return (
    (data ?? []) as Array<{ event_type: EventType; guide_id: string | null; event_count: number }>
  ).map((row) => ({
    eventType: row.event_type,
    guideId: row.guide_id,
    count: Number(row.event_count),
  }));
}

/** Real backend: authed client, RPC `guide_analytics_summary`. */
export async function getGuideAnalyticsSummary(
  actor: StudioActor,
  guideId: string,
  range?: AnalyticsRange,
): Promise<AnalyticsSummaryRow[]> {
  if (actor.role === "guide" && actor.guideId !== guideId) {
    throw new StudioPermissionError(`Guide actor may not read analytics for guide ${guideId}.`);
  }

  if (isTestEnv) {
    if (actor.role === "company") {
      const guide = fakeStore.guides.find((g) => g.id === guideId);
      if (!guide || guide.companyId !== actor.companyId) {
        throw new StudioPermissionError(
          `Company actor may not read analytics for guide ${guideId}.`,
        );
      }
    }

    const counts = new Map<string, AnalyticsSummaryRow>();
    for (const e of fakeStore.events) {
      if (e.guideId !== guideId || !inRange(e.occurredAt, range)) continue;
      // Booking financial/outcome data is admin-only — see
      // getCompanyAnalyticsSummary's identical comment just above.
      if (e.eventType === "booking_outcome" && actor.role !== "admin") continue;
      // Test/staging-originated rows never count toward real numbers — see
      // getCompanyAnalyticsSummary's identical comment just above.
      if (e.isTest) continue;
      const row = counts.get(e.eventType) ?? { eventType: e.eventType, guideId, count: 0 };
      row.count += bookingOutcomeIncrement(e);
      counts.set(e.eventType, row);
    }
    return [...counts.values()];
  }

  const supabase = await authedClient();
  if (actor.role === "company") {
    const { data: guideRow, error: guideError } = await supabase
      .from("guides")
      .select("company_id")
      .eq("id", guideId)
      .maybeSingle();
    if (guideError) throw guideError;
    const row = guideRow as Pick<GuideRow, "company_id"> | null;
    if (!row || row.company_id !== actor.companyId) {
      throw new StudioPermissionError(
        `Company actor may not read analytics for guide ${guideId}.`,
      );
    }
  }

  const { data, error } = await supabase.rpc("guide_analytics_summary", {
    p_guide_id: guideId,
    ...rangeParams(range),
  });
  if (error) throw error;
  return ((data ?? []) as Array<{ event_type: EventType; event_count: number }>).map((row) => ({
    eventType: row.event_type,
    guideId,
    count: Number(row.event_count),
  }));
}

/**
 * Admin-only, platform-wide (PRD §8.4).
 *
 * Real backend: authed client (NOT the service-role admin client — an
 * admin's own authenticated session already has full cross-tenant
 * visibility via admin_full_access on events, exactly what the RPC's own
 * comment describes). RPC `admin_platform_analytics`.
 */
export async function getPlatformAnalyticsSummary(
  actor: StudioActor,
  range?: AnalyticsRange,
): Promise<Array<AnalyticsSummaryRow & { companyId: string; companyName: string }>> {
  if (actor.role !== "admin") {
    throw new StudioPermissionError("Only admin may read platform-wide analytics.");
  }

  if (isTestEnv) {
    const counts = new Map<
      string,
      AnalyticsSummaryRow & { companyId: string; companyName: string }
    >();
    for (const e of fakeStore.events) {
      if (!e.companyId || !inRange(e.occurredAt, range)) continue;
      // Test/staging-originated rows never count toward real numbers — see
      // getCompanyAnalyticsSummary's identical comment above.
      if (e.isTest) continue;
      const company = fakeStore.companies.find((c) => c.id === e.companyId);
      if (!company) continue;
      const key = `${company.id}::${e.eventType}`;
      const row =
        counts.get(key) ??
        {
          companyId: company.id,
          companyName: company.name,
          eventType: e.eventType,
          guideId: null,
          count: 0,
        };
      row.count += bookingOutcomeIncrement(e);
      counts.set(key, row);
    }
    return [...counts.values()];
  }

  const supabase = await authedClient();
  const { data, error } = await supabase.rpc("admin_platform_analytics", rangeParams(range));
  if (error) throw error;
  return (
    (data ?? []) as Array<{
      company_id: string;
      company_name: string;
      event_type: EventType;
      event_count: number;
    }>
  ).map((row) => ({
    companyId: row.company_id,
    companyName: row.company_name,
    eventType: row.event_type,
    guideId: null,
    count: Number(row.event_count),
  }));
}

// =============================================================================
// Admin-only reads/writes (PRD §8).
// =============================================================================

/** Real backend: authed client, unfiltered select (admin_full_access does the rest). */
export async function listCompanies(actor: StudioActor): Promise<CompanyRecord[]> {
  if (actor.role !== "admin") throw new StudioPermissionError("Only admin may list all companies.");

  if (isTestEnv) return [...fakeStore.companies];

  const supabase = await authedClient();
  const { data, error } = await supabase.from("companies").select("*");
  if (error) throw error;
  return ((data ?? []) as CompanyRow[]).map(fromCompanyRow);
}

/**
 * Real backend: authed client. RLS (authenticated_read_catalog) technically
 * permits ANY authenticated role to read boat_tours in full — the in-code
 * admin-only gate here is deliberately STRICTER than RLS, because this
 * function backs Admin's catalog-management screen specifically (as
 * opposed to getBoatCatalogForStudio, the company/guide-facing read). This
 * gate is load-bearing, not redundant: keep it even though RLS alone would
 * allow more.
 */
export async function listBoatTourCatalog(actor: StudioActor): Promise<BoatTourRecord[]> {
  if (actor.role !== "admin") {
    throw new StudioPermissionError("Only admin may manage the boat tour catalog.");
  }

  if (isTestEnv) {
    return [...fakeStore.boatTours].sort((a, b) => a.position - b.position);
  }

  const supabase = await authedClient();
  const { data, error } = await supabase.from("boat_tours").select("*").order("position");
  if (error) throw error;
  return ((data ?? []) as BoatTourRow[]).map(fromBoatTourRow);
}

function assertAdmin(actor: StudioActor, action: string): void {
  if (actor.role !== "admin") {
    throw new StudioPermissionError(`Only admin may ${action}.`);
  }
}

/**
 * Flags `companyId` as the platform default (see getPlatformDefaultCompany's
 * doc comment) and clears the flag on every other row — the partial unique
 * index (supabase/migrations/20260823190000_platform_default_company.sql)
 * would refuse a second `true` row anyway, but clearing the old holder first
 * means a caller never has to know which row that was. Admin-only: this is
 * the one write path for the flag, reached from Admin's
 * /admin/default-company page and CompanyRowActions' "Set as default" menu
 * item.
 *
 * Two plain updates rather than one atomic statement — fine here (unlike
 * most writes in this file) because admin is the only actor who can ever
 * call this and there is no concurrent-writer race worth guarding against
 * for a single staff-operated toggle.
 */
export async function setPlatformDefaultCompany(actor: StudioActor, companyId: string): Promise<void> {
  assertAdmin(actor, "set the platform default company");

  if (isTestEnv) {
    if (!fakeStore.companies.some((c) => c.id === companyId)) {
      throw new StudioPermissionError(`Company ${companyId} not found.`);
    }
    fakeStore.platformDefaultCompanyId = companyId;
    return;
  }

  const supabase = await authedClient();
  const { error: clearError } = await supabase
    .from("companies")
    .update({ is_platform_default: false })
    .eq("is_platform_default", true)
    .neq("id", companyId);
  if (clearError) throw clearError;

  const { data, error } = await supabase
    .from("companies")
    .update({ is_platform_default: true })
    .eq("id", companyId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new StudioPermissionError(`Company ${companyId} not found.`);
}

/** Un-flags whichever company currently holds the platform-default flag, if any. Admin-only, same guard as setPlatformDefaultCompany above. */
export async function unsetPlatformDefaultCompany(actor: StudioActor): Promise<void> {
  assertAdmin(actor, "unset the platform default company");

  if (isTestEnv) {
    fakeStore.platformDefaultCompanyId = null;
    return;
  }

  const supabase = await authedClient();
  const { error } = await supabase
    .from("companies")
    .update({ is_platform_default: false })
    .eq("is_platform_default", true);
  if (error) throw error;
}

/**
 * Creates or updates a boat tour in the platform catalog (PRD §8.2). This is
 * the ONLY place a boat tour can be created or edited — Studio's Boat tours
 * tab (setBoatFeature above) only toggles/reorders which of these a company
 * features on its own guest map; it never touches the tour itself.
 *
 * Real backend: authed client. RLS: admin_full_access is the ONLY write
 * policy on boat_tours — RLS alone already fully enforces admin-only here
 * (the in-code assertAdmin above is still kept, per this file's own rule
 * about which direction to be redundant in).
 */
export async function saveBoatTour(
  actor: StudioActor,
  input: SaveBoatTourInput,
): Promise<BoatTourRecord> {
  assertAdmin(actor, "create or edit boat tours");

  if (isTestEnv) {
    if (input.id) {
      const existing = fakeStore.boatTours.find((t) => t.id === input.id);
      if (!existing) throw new StudioPermissionError(`Boat tour ${input.id} not found.`);
      Object.assign(existing, {
        name: input.name,
        area: input.area,
        lng: input.lng,
        lat: input.lat,
        meta: input.meta,
        note: input.note,
        bookingUrl: input.bookingUrl,
        photos: input.photos,
        position: input.position ?? existing.position,
        status: input.status ?? existing.status,
        updatedAt: new Date().toISOString(),
      });
      return existing;
    }

    const created = new Date().toISOString();
    const maxPosition = fakeStore.boatTours.reduce((max, t) => Math.max(max, t.position), 0);
    const record: BoatTourRecord = {
      id: fakeId("boat-tour"),
      name: input.name,
      area: input.area,
      lng: input.lng,
      lat: input.lat,
      meta: input.meta,
      note: input.note,
      bookingUrl: input.bookingUrl,
      photos: input.photos,
      position: input.position ?? maxPosition + 1,
      status: input.status ?? "active",
      createdAt: created,
      updatedAt: created,
      // A tour created here is always admin-curated by hand, through this
      // very function — the only way BoatLocal identity fields ever get set
      // is syncCruiseFromBoatLocal below. See BoatTourRecord's own doc
      // comment for why every one of these must stay nullable.
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
    };
    fakeStore.boatTours.push(record);
    return record;
  }

  const supabase = await authedClient();

  if (input.id) {
    const updates: Partial<BoatTourRow> = {
      name: input.name,
      area: input.area,
      lng: input.lng,
      lat: input.lat,
      meta: input.meta,
      note: input.note,
      booking_url: input.bookingUrl,
      photos: input.photos,
    };
    if (input.position !== undefined) updates.position = input.position;
    if (input.status !== undefined) updates.status = input.status;

    const { data, error } = await supabase
      .from("boat_tours")
      .update(updates)
      .eq("id", input.id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new StudioPermissionError(`Boat tour ${input.id} not found.`);
    return fromBoatTourRow(data as BoatTourRow);
  }

  const { data: maxRow, error: maxError } = await supabase
    .from("boat_tours")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxError) throw maxError;
  const maxPosition = (maxRow as Pick<BoatTourRow, "position"> | null)?.position ?? 0;

  const { data, error } = await supabase
    .from("boat_tours")
    .insert({
      name: input.name,
      area: input.area,
      lng: input.lng,
      lat: input.lat,
      meta: input.meta,
      note: input.note,
      booking_url: input.bookingUrl,
      photos: input.photos,
      position: input.position ?? maxPosition + 1,
      status: input.status ?? "active",
    })
    .select("*")
    .single();
  if (error) throw error;
  return fromBoatTourRow(data as BoatTourRow);
}

/**
 * Removes a boat tour from the platform catalog entirely (PRD §8.2,
 * admin-only). Every company's `company_boat_features` row for this tour is
 * removed automatically by the DB's `on delete cascade` — no manual cleanup
 * query is needed against the real backend (unlike the fakeStore branch,
 * which has no cascade and must filter the array itself).
 */
export async function deleteBoatTour(actor: StudioActor, id: string): Promise<void> {
  assertAdmin(actor, "delete boat tours");

  if (isTestEnv) {
    const idx = fakeStore.boatTours.findIndex((t) => t.id === id);
    if (idx === -1) return;
    fakeStore.boatTours.splice(idx, 1);
    fakeStore.companyBoatFeatures = fakeStore.companyBoatFeatures.filter(
      (f) => f.boatTourId !== id,
    );
    return;
  }

  const supabase = await authedClient();
  const { error } = await supabase.from("boat_tours").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Sets a tour's catalog-wide position directly (Admin's up/down reorder
 * control) — a narrower sibling of saveBoatTour for when only the order
 * changes, so a quick reorder click doesn't need to resend every other
 * field. Distinct from `company_boat_features.position`, which is each
 * tenant's own featured order (see getBoatTours' comment above) and is
 * changed via setBoatFeature, not this.
 */
export async function setBoatTourPosition(
  actor: StudioActor,
  id: string,
  position: number,
): Promise<void> {
  assertAdmin(actor, "reorder the boat tour catalog");

  if (isTestEnv) {
    const tour = fakeStore.boatTours.find((t) => t.id === id);
    if (!tour) throw new StudioPermissionError(`Boat tour ${id} not found.`);
    tour.position = position;
    tour.updatedAt = new Date().toISOString();
    return;
  }

  const supabase = await authedClient();
  const { data, error } = await supabase
    .from("boat_tours")
    .update({ position })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new StudioPermissionError(`Boat tour ${id} not found.`);
}

/**
 * Neutral starter brand for a newly onboarded company (Admin's flow, PRD
 * §8.3), used only until the company customises it via Studio > Branding
 * (PRD §7.2 — updateCompanyBranding). Deliberately a plain neutral grey, not
 * one of src/lib/brand.ts's BRANDS presets (those are demo tenants, not a
 * "default for new tenants") and not read from CSS custom properties (this
 * is seed data for a row that doesn't exist yet, not component styling —
 * the "brand colour comes from brandCssVars()" rule is about components,
 * not about what an INSERT's default column values are).
 */
const ONBOARDING_DEFAULT_BRAND = {
  primary: "#52525B",
  primaryDark: "#3F3F46",
  accent: "#A1A1AA",
  surround: "#F4F4F5",
};

/**
 * The founder's planned "every new company starts with N admin-curated
 * recommendations" seed list ("I'll give you the four") — DELIBERATELY
 * EMPTY until the founder supplies the real content. Do NOT invent
 * placeholder recommendations here (no fake venue names, no lorem-ipsum,
 * nothing that could accidentally ship as real guest-facing copy) — an
 * admin-owned recommendation is guest-visible the instant it's created (see
 * this migration's own comment: guest_public_read has no owner_type
 * filter), so seeding fabricated content here would leak fake places onto
 * a brand-new company's real guest map the moment it's onboarded.
 *
 * createCompany() below loops over this array and inserts one owner_type
 * 'admin' recommendation per entry for the newly-created company, via the
 * exact same saveRecommendation() path Admin's own "Admin recommendations
 * for {company}" UI uses (src/components/admin/AdminRecommendationsManager.tsx)
 * — so the ONLY remaining step once the founder hands over the real four is
 * populating this array; zero further engineering. Confirmed empty (seeds
 * nothing) by src/lib/data/source.test.ts's
 * "createCompany seeds no admin recommendations while the default list is empty" case.
 */
const DEFAULT_ADMIN_RECOMMENDATIONS: Array<
  Omit<SaveRecommendationInput, "id" | "companyId" | "visible">
> = [];

/**
 * Admin's "create/onboard a company" flow (PRD §8.3). There is nothing for
 * an admin to type as the company's identifier any more — its `id`
 * (`gen_random_uuid()`, the primary key) is the only identifier guest links
 * ever need, assigned by the database default on insert like any other row.
 * Thrown as a plain Error, not StudioPermissionError, when name/owner-email
 * validation fails, since that's a data-validation problem, not a
 * permission problem.
 *
 * Also mints the company's owner invite (owner_status: 'invited' +
 * owner_invite_token, mirroring inviteGuide's invite_token) — this used to
 * be a flagged gap (this function only created the `companies` row, with no
 * path for anyone to actually sign in and manage it) until
 * 20260807000000_company_owner_invite.sql closed it. Redemption itself
 * (creating the auth user + profiles row) happens at src/app/join/[token],
 * the same place a guide's invite is redeemed.
 *
 * Also seeds DEFAULT_ADMIN_RECOMMENDATIONS (see that constant's own
 * comment) into the brand-new company, one saveRecommendation() call per
 * entry, sequentially (same "stop at the first failure, don't roll back
 * what already landed" reasoning as reorderBoatToursAction in
 * src/lib/admin/boatTourActions.ts — a small, admin-curated list, so N
 * sequential calls is an acceptable cost). Currently a no-op loop over an
 * empty array; see that constant for when this stops being true.
 *
 * Real backend: authed client.
 */
export async function createCompany(
  actor: StudioActor,
  input: CreateCompanyInput,
): Promise<CompanyRecord> {
  if (actor.role !== "admin") {
    throw new StudioPermissionError("Only admin may onboard a new company.");
  }

  const name = input.name.trim();
  if (!name) throw new Error("Company name is required.");

  const ownerEmail = input.ownerEmail.trim();
  if (!ownerEmail) throw new Error("Owner email is required.");

  if (isTestEnv) {
    const created = new Date().toISOString();
    const record: CompanyRecord = {
      id: fakeId("company"),
      name,
      companyType: input.companyType?.trim() || null,
      appName: name,
      brandPrimary: ONBOARDING_DEFAULT_BRAND.primary,
      brandPrimaryDark: ONBOARDING_DEFAULT_BRAND.primaryDark,
      brandAccent: ONBOARDING_DEFAULT_BRAND.accent,
      brandSurround: ONBOARDING_DEFAULT_BRAND.surround,
      logoUrl: null,
      campaignParams: null,
      googleReviewUrl: null,
      tripadvisorReviewUrl: null,
      reviewPlatform: "google",
      customDomain: null,
      status: "setup",
      ownerEmail,
      ownerStatus: "invited",
      createdAt: created,
      updatedAt: created,
    };
    fakeStore.companies.push(record);
    for (const seed of DEFAULT_ADMIN_RECOMMENDATIONS) {
      await saveRecommendation({ role: "admin" }, { ...seed, companyId: record.id });
    }
    return record;
  }

  const supabase = await authedClient();

  const { data, error } = await supabase
    .from("companies")
    .insert({
      name,
      company_type: input.companyType?.trim() || null,
      app_name: name,
      brand_primary: ONBOARDING_DEFAULT_BRAND.primary,
      brand_primary_dark: ONBOARDING_DEFAULT_BRAND.primaryDark,
      brand_accent: ONBOARDING_DEFAULT_BRAND.accent,
      brand_surround: ONBOARDING_DEFAULT_BRAND.surround,
      status: "setup",
      owner_email: ownerEmail,
      owner_status: "invited",
      owner_invite_token: generateInviteToken(),
    })
    .select("*")
    .single();
  if (error) throw error;
  const created = fromCompanyRow(data as CompanyRow);

  for (const seed of DEFAULT_ADMIN_RECOMMENDATIONS) {
    await saveRecommendation({ role: "admin" }, { ...seed, companyId: created.id });
  }

  return created;
}

/**
 * Flips a company between setup/live/suspended. Admin may set any status;
 * a company may only toggle itself between 'setup' and 'active' — its own
 * self-service "publish / unpublish" (Studio), not a status Admin has to
 * pick at onboarding time any more. 'suspended' stays admin-only in both
 * directions — a punitive action a company can't self-reactivate out of,
 * matching how a guide can't self-reactivate in setGuideStatus above.
 * supabase/migrations/20260823150000_company_type_free_text_and_self_publish.sql's
 * company_update_own_branding policy enforces the same rule server-side.
 */
export async function setCompanyStatus(
  actor: StudioActor,
  companyId: string,
  status: CompanyStatus,
): Promise<CompanyRecord> {
  if (actor.role === "admin") {
    // no further restriction
  } else if (actor.role === "company" && actor.companyId === companyId) {
    if (status === "suspended") {
      throw new StudioPermissionError("A company may not suspend itself.");
    }
  } else {
    throw new StudioPermissionError("Only admin, or the company itself, may change its status.");
  }

  if (isTestEnv) {
    const company = fakeStore.companies.find((c) => c.id === companyId);
    if (!company) throw new StudioPermissionError(`Company ${companyId} not found.`);
    if (actor.role === "company" && company.status === "suspended") {
      throw new StudioPermissionError("A suspended company may not reactivate itself.");
    }

    company.status = status;
    company.updatedAt = new Date().toISOString();
    return company;
  }

  const supabase = await authedClient();
  const { data, error } = await supabase
    .from("companies")
    .update({ status })
    .eq("id", companyId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new StudioPermissionError(`Company ${companyId} not found.`);
  return fromCompanyRow(data as CompanyRow);
}

/**
 * Permanently removes a company and everything scoped to it (guides,
 * featured-boat-tour picks, recommendations, guest sessions, events) —
 * every FK into `companies` is `on delete cascade`
 * (supabase/migrations/20260805063610_init_schema.sql), so one DELETE here
 * is enough; nothing needs a manual multi-table cleanup pass. Admin-only,
 * same guard as setCompanyStatus above, and irreversible in a way status
 * changes aren't — the confirmation UX lives in
 * src/components/admin/CompanyRowActions.tsx, not here.
 */
export async function deleteCompany(actor: StudioActor, companyId: string): Promise<void> {
  if (actor.role !== "admin") {
    throw new StudioPermissionError("Only admin may delete a company.");
  }

  if (isTestEnv) {
    const idx = fakeStore.companies.findIndex((c) => c.id === companyId);
    if (idx === -1) throw new StudioPermissionError(`Company ${companyId} not found.`);
    fakeStore.companies.splice(idx, 1);
    fakeStore.guides = fakeStore.guides.filter((g) => g.companyId !== companyId);
    fakeStore.companyBoatFeatures = fakeStore.companyBoatFeatures.filter(
      (f) => f.companyId !== companyId,
    );
    fakeStore.recommendations = fakeStore.recommendations.filter(
      (r) => r.companyId !== companyId,
    );
    fakeStore.events = fakeStore.events.filter((e) => e.companyId !== companyId);
    return;
  }

  const supabase = await authedClient();
  const { error, count } = await supabase
    .from("companies")
    .delete({ count: "exact" })
    .eq("id", companyId);
  if (error) throw error;
  if (!count) throw new StudioPermissionError(`Company ${companyId} not found.`);
}

// Re-exported so callers only need one import for the category lookups they
// often need next to a Place/MapPin (e.g. pin colour). Not a data-access
// concern per se, but keeping it here avoids a second import line at every
// call site that already imports from this module.
export function categoryLabel(id: CategoryId): string {
  return CATEGORY_MAP[id]?.label ?? id;
}

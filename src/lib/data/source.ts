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
import { initialFromName, uniqueSlug } from "../slug";
import type { Brand, CategoryId, Guide, Place } from "../types";
import type { BoatTour as BoatTourView } from "../types";
import { fakeId, fakeStore } from "./fakeStore";
import type {
  AnalyticsRange,
  AnalyticsSummaryRow,
  BoatTourRecord,
  BoatTourStatus,
  CompanyRecord,
  CompanyStatus,
  CompanyType,
  CreateCompanyInput,
  EventPlatform,
  EventType,
  GuideRecord,
  GuideStatus,
  InviteGuideInput,
  NewEventInput,
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
// src/lib/attribution.ts (`createClickId`, `buildBookingUrl`). That module
// reads `NEXT_PUBLIC_BOOKING_BASE_URL` the same way this file's other
// functions read their env config; see docs/attribution.md for the full
// flow. `BoatTourRecord.bookingUrl` below is exactly the value
// `attribution.ts`'s `buildBookingUrl({ tourId, clickId, ... })` starts
// from.

// =============================================================================
// Test-environment detection + Supabase client tiers.
// =============================================================================

// Vitest sets this automatically (verified empirically — see file header).
// Deliberately narrow (not also keyed off NODE_ENV==='test') so a
// misconfigured production NODE_ENV can never silently divert real traffic
// to the in-memory fake store.
const isTestEnv = process.env.VITEST === "true";

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
 * Used only by findAttributedClick/recordBookingOutcome below, for the
 * BoatLocal conversion webhook: that caller is neither a guest (anon can
 * only INSERT events, never read them back — see "guest_insert_events" in
 * supabase/migrations/20260805063611_rls_policies.sql) nor a signed-in
 * Studio actor with a session to scope against. It's BoatLocal's own
 * server calling ours directly, authenticated only by the HMAC signature
 * attributionWebhook.ts already verifies before either function below is
 * ever reached — there is no narrower real client to reach for here.
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
  category: CategoryId;
  name: string;
  area: string;
  address: string;
  lng: number;
  lat: number;
  note: string;
  hours: string;
  photos: string[];
  visible: boolean;
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
    category: row.category,
    name: row.name,
    area: row.area,
    address: row.address,
    lng: row.lng,
    lat: row.lat,
    note: row.note,
    hours: row.hours,
    photos: row.photos,
    visible: row.visible,
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

function toBrand(company: CompanyRecord): Brand {
  return {
    id: company.id,
    companyName: company.name,
    appName: company.appName,
    primary: company.brandPrimary,
    primaryDark: company.brandPrimaryDark,
    accent: company.brandAccent,
    surround: company.brandSurround,
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
    category: rec.category,
    area: rec.area,
    address: rec.address,
    lng: rec.lng,
    lat: rec.lat,
    note: rec.note,
    hours: rec.hours,
    photos: rec.photos,
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
  category: CategoryId;
  area: string;
  lng: number;
  lat: number;
  note: string;
  meta: string;
  photos: string[];
  is_boat: boolean;
  booking_url: string | null;
}

/**
 * Unified pin feed for the guest map — boats first (the booking business
 * model must never be buried), then everything else. Matches
 * src/lib/data.ts's ALL_PINS shape exactly.
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
      category: "boats",
      area: t.area,
      lng: t.lng,
      lat: t.lat,
      note: t.note,
      meta: t.meta,
      photos: t.photos,
      isBoat: true,
      bookingUrl: t.bookingUrl,
    }));

    const placePins: MapPin[] = places.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      area: p.area,
      lng: p.lng,
      lat: p.lat,
      note: p.note,
      meta: p.hours,
      photos: p.photos,
      isBoat: false,
    }));

    return [...boatPins, ...placePins];
  }

  const { data, error } = await anonClient().rpc("guest_map_pins", { p_company_id: companyId });
  if (error) throw error;
  return ((data ?? []) as MapPinRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    area: row.area,
    lng: row.lng,
    lat: row.lat,
    note: row.note,
    meta: row.meta,
    photos: row.photos,
    isBoat: row.is_boat,
    bookingUrl: row.is_boat ? (row.booking_url ?? undefined) : undefined,
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
    });
  if (error) throw error;
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
}

export interface RecordBookingOutcomeResult {
  /** False on a retried delivery of a booking already recorded — see the webhook route's idempotency contract in docs/attribution.md. */
  inserted: boolean;
  /** Whether a matching click was found — independent of `inserted`; a dedup still reports the original delivery's attribution. */
  attributed: boolean;
}

/**
 * Records a `booking_outcome` event for a completed/cancelled BoatLocal
 * booking, attributed to whichever company/guide/tour the original click
 * belongs to (null fields when unattributed). Deduped on `bookingId` in
 * metadata — BoatLocal retries any non-2xx response, so a retried delivery
 * of the same booking must be a no-op, never a second row.
 */
export async function recordBookingOutcome(
  input: RecordBookingOutcomeInput,
): Promise<RecordBookingOutcomeResult> {
  const click = await findAttributedClick(input.clickId);
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

  if (isTestEnv) {
    const alreadyRecorded = fakeStore.events.some(
      (e) => e.eventType === "booking_outcome" && e.metadata?.bookingId === input.bookingId,
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
    });
    return { inserted: true, attributed: !!click };
  }

  const supabase = await adminClient();

  const { data: existing, error: existingError } = await supabase
    .from("events")
    .select("id")
    .eq("event_type", "booking_outcome")
    .eq("metadata->>bookingId", input.bookingId)
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
  });
  if (error) throw error;

  return { inserted: true, attributed: !!click };
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
 * Recommendations visible to this actor in Studio: admin sees all, a
 * company sees every row under its own tenant (base list + every guide's
 * items, for dashboards), a guide sees the base list read-only plus their
 * own items — never another guide's items, never another tenant's rows.
 *
 * Real backend: authed client. Admin: unfiltered select (admin_full_access
 * does the rest). Company/guide: `.eq('company_id', actor.companyId)` is
 * enough — RLS (company_select_own_tenant / guide_select_base_and_own)
 * narrows a guide's rows to base-list+own server-side, so no client-side
 * owner_type/guideId re-filtering is needed for the real query (the
 * fakeStore branch below keeps its own in-code filtering, which is harmless
 * duplication once RLS is real, per this file's own mapping notes).
 */
export async function getRecommendationsForStudio(
  actor: StudioActor,
): Promise<RecommendationRecord[]> {
  if (isTestEnv) {
    if (actor.role === "admin") return [...fakeStore.recommendations];

    if (actor.role === "company") {
      return fakeStore.recommendations.filter((r) => r.companyId === actor.companyId);
    }

    // guide
    return fakeStore.recommendations.filter(
      (r) =>
        r.companyId === actor.companyId &&
        (r.ownerType === "company" || r.guideId === actor.guideId),
    );
  }

  const supabase = await authedClient();
  let query = supabase.from("recommendations").select("*");
  if (actor.role !== "admin") {
    query = query.eq("company_id", actor.companyId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as RecommendationRow[]).map(fromRecommendationRow);
}

/**
 * Creates or updates a recommendation. A company may only write base-list
 * rows (ownerType "company") in its own tenant; a guide may only write
 * their own rows. Mirrors company_manage_base_list / guide_manage_own_items.
 *
 * Real backend: authed client. Admin refusal and the boats-category refusal
 * are both applied before any query — the admin refusal is LOAD-BEARING (a
 * business rule, "admin does not own tenant content", not just RLS-
 * mirroring: RLS's admin_full_access would technically permit the write).
 * For an edit, the existing row is fetched first (via the same authed
 * client, so RLS narrows what an actor can even see) to reproduce the exact
 * ownership check the fakeStore branch makes; if RLS itself already hides
 * the row from this actor (e.g. a guide targeting another guide's item),
 * that fetch returns null and this throws the same StudioPermissionError a
 * mismatched-but-visible row would — see file-level note on
 * deleteRecommendation for the one case where this can't be reproduced
 * identically.
 */
export async function saveRecommendation(
  actor: StudioActor,
  input: SaveRecommendationInput,
): Promise<RecommendationRecord> {
  if (actor.role === "admin") {
    throw new StudioPermissionError(
      "Admin does not own tenant recommendations; act as the company or guide instead.",
    );
  }
  if (input.category === "boats") {
    // Enforced at the DB layer too (recommendation_category_not_boats CHECK).
    throw new StudioPermissionError("Boat tours are a separate table, never a recommendation.");
  }

  const companyId = actor.companyId;
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
        category: input.category,
        name: input.name,
        area: input.area,
        address: input.address,
        lng: input.lng,
        lat: input.lat,
        note: input.note,
        hours: input.hours,
        photos: input.photos,
        visible: input.visible ?? existing.visible,
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
      category: input.category,
      name: input.name,
      area: input.area,
      address: input.address,
      lng: input.lng,
      lat: input.lat,
      note: input.note,
      hours: input.hours,
      photos: input.photos,
      visible: input.visible ?? true,
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
        category: input.category,
        name: input.name,
        area: input.area,
        address: input.address,
        lng: input.lng,
        lat: input.lat,
        note: input.note,
        hours: input.hours,
        photos: input.photos,
        visible: input.visible ?? existing.visible,
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
      category: input.category,
      name: input.name,
      area: input.area,
      address: input.address,
      lng: input.lng,
      lat: input.lat,
      note: input.note,
      hours: input.hours,
      photos: input.photos,
      visible: input.visible ?? true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return fromRecommendationRow(data as RecommendationRow);
}

/**
 * Real backend: authed client. See saveRecommendation's comment on why the
 * existing row is fetched first. DOCUMENTED BEHAVIOUR DIFFERENCE: if the
 * actor cannot even SELECT the target row under RLS (e.g. a guide targeting
 * another guide's item, or any actor targeting a row outside their tenant),
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
      const key = `${e.eventType}::${e.guideId ?? ""}`;
      const row = counts.get(key) ?? { eventType: e.eventType, guideId: e.guideId, count: 0 };
      row.count += 1;
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
      const row = counts.get(e.eventType) ?? { eventType: e.eventType, guideId, count: 0 };
      row.count += 1;
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
      row.count += 1;
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
      status: "setup",
      ownerEmail,
      ownerStatus: "invited",
      createdAt: created,
      updatedAt: created,
    };
    fakeStore.companies.push(record);
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
  return fromCompanyRow(data as CompanyRow);
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

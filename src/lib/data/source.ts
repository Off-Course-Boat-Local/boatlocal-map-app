// Boat Local Map App — typed data-access interface.
//
// Every screen (guest app, Studio, Admin) should import from *this file*,
// never from src/lib/data/fakeStore.ts and never from a Supabase client
// directly. That is the whole point of a DataSource-style interface: when a
// real Supabase project exists, only the bodies of the functions below
// change to `await supabase.from(...)` / `.rpc(...)` calls — every caller,
// every component prop, every test stays exactly as it is.
//
// Backing store: src/lib/data/fakeStore.ts, itself seeded from the existing
// src/lib/data.ts + src/lib/brand.ts fake data (one company, one guide
// "Jan", 14 recommendations, 6 boat tours). See supabase/seed.sql for the
// SQL-shaped equivalent of the same tenant.
//
// Every function is `async` and returns a `Promise`, even though the fake
// store is synchronous — so call sites are already written the way they'll
// have to be once these are real network calls, and no call site needs to
// change shape when that happens.
//
// Permission model: functions that touch tenant- or guide-scoped data take
// a `StudioActor` and enforce the exact same rules as the RLS policies in
// supabase/migrations/20260805063611_rls_policies.sql (admin: everything;
// company: own tenant; guide: own items + company's base list, read-only).
// Once real Supabase Auth + RLS exist, these in-code checks become a second,
// redundant line of defence rather than the only one — which is the correct
// direction to be redundant in.

import { CATEGORY_MAP } from "../categories";
import type { MapPin } from "../data";
import {
  RESERVED_SUBDOMAINS,
  initialFromName,
  isUrlSafeSubdomain,
  slugify,
  uniqueSlug,
} from "../slug";
import type { Brand, CategoryId, Guide, Place } from "../types";
import type { BoatTour as BoatTourView } from "../types";
import { fakeId, fakeStore } from "./fakeStore";
import type {
  AnalyticsRange,
  AnalyticsSummaryRow,
  BoatTourRecord,
  CompanyRecord,
  CompanyStatus,
  CreateCompanyInput,
  EventPlatform,
  GuideRecord,
  GuideStatus,
  InviteGuideInput,
  NewEventInput,
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
// Guest-facing reads (unauthenticated — matches the `anon` RLS policies).
// =============================================================================

function toBrand(company: CompanyRecord): Brand {
  return {
    id: company.subdomain,
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

/**
 * Subdomain -> brand resolution (PRD §11 / §13.1). Called from middleware in
 * the real app to resolve `{company}.app.boatlocal.nl` before rendering.
 *
 * TODO: replace with Supabase query once the project exists:
 *   supabase.rpc('company_by_subdomain', { p_subdomain: subdomain })
 * (see supabase/migrations/20260805063612_helper_functions.sql).
 */
export async function getCompanyBrand(subdomain: string): Promise<Brand | null> {
  const company = fakeStore.companies.find(
    (c) => c.subdomain === subdomain && c.status === "active",
  );
  return company ? toBrand(company) : null;
}

/**
 * Full company row for a subdomain, for callers that need more than brand
 * colours (e.g. review URLs, campaign params). Deliberately NOT status-
 * filtered — Studio's own tenant lookup needs to find a company regardless
 * of status (e.g. to see or reactivate a deactivated one). Guest-facing
 * code must use getActiveCompanyRecord below instead; using this one from
 * a guest code path is almost certainly a bug.
 */
export async function getCompanyRecord(subdomain: string): Promise<CompanyRecord | null> {
  return fakeStore.companies.find((c) => c.subdomain === subdomain) ?? null;
}

/**
 * Guest-facing version of getCompanyRecord: returns null for a deactivated
 * company exactly as it would for a nonexistent one, so every value derived
 * from the result (companyId, guide, recommendations, boat tours) collapses
 * to "not found" together, rather than leaving a real companyId in play
 * that still unlocks a deactivated tenant's data through getPlaces /
 * getBoatTours / getMapPins.
 *
 * TODO: once this is a real Supabase query, this is just
 *   .eq('status', 'active') added to getCompanyRecord's own query — the
 *   split back into one function again, since RLS's guest_public_read
 *   policy on `companies` already enforces the same status check.
 */
export async function getActiveCompanyRecord(
  subdomain: string,
): Promise<CompanyRecord | null> {
  const company = await getCompanyRecord(subdomain);
  return company && company.status === "active" ? company : null;
}

/**
 * Path segment -> guide (PRD §13.1: guide comes from the first path
 * segment, e.g. hotelv.app.boatlocal.nl/jan).
 *
 * TODO: replace with Supabase query once the project exists:
 *   supabase.rpc('guide_by_slug', { p_company_id, p_slug })
 */
export async function getGuide(companyId: string, slug: string): Promise<Guide | null> {
  const guide = fakeStore.guides.find(
    (g) => g.companyId === companyId && g.slug === slug && g.status === "active",
  );
  return guide ? toGuideView(guide) : null;
}

/**
 * Visible recommendations for one tenant (guest map/list). Boats are never
 * included here — see getBoatTours.
 *
 * TODO: replace with Supabase query once the project exists:
 *   supabase.from('recommendations').select().eq('company_id', companyId).eq('visible', true)
 */
export async function getPlaces(companyId: string): Promise<Place[]> {
  return fakeStore.recommendations
    .filter((r) => r.companyId === companyId && r.visible)
    .map(toPlace);
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
 * TODO: replace with Supabase query once the project exists:
 *   supabase.from('company_boat_features').select('position, boat_tours(*)')
 *     .eq('company_id', companyId).eq('is_featured', true).order('position')
 */
export async function getBoatTours(companyId: string): Promise<BoatTourView[]> {
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

/**
 * Unified pin feed for the guest map — boats first (the booking business
 * model must never be buried), then everything else. Matches
 * src/lib/data.ts's ALL_PINS shape exactly.
 *
 * TODO: replace with Supabase query once the project exists:
 *   supabase.rpc('guest_map_pins', { p_company_id: companyId })
 */
export async function getMapPins(companyId: string): Promise<MapPin[]> {
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

/**
 * Fires an analytics event (PRD §10). Guest app calls this unauthenticated
 * and fire-and-forget — matches the `anon` insert-only policy on `events`.
 *
 * TODO: replace with Supabase query once the project exists:
 *   supabase.from('events').insert({ ... })
 */
export async function recordEvent(input: NewEventInput): Promise<void> {
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
 */
export async function getRecommendationsForStudio(
  actor: StudioActor,
): Promise<RecommendationRecord[]> {
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

/**
 * Creates or updates a recommendation. A company may only write base-list
 * rows (ownerType "company") in its own tenant; a guide may only write
 * their own rows. Mirrors company_manage_base_list / guide_manage_own_items.
 *
 * TODO: replace with Supabase query once the project exists:
 *   supabase.from('recommendations').upsert({ ... })
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

  if (input.id) {
    const existing = fakeStore.recommendations.find((r) => r.id === input.id);
    if (!existing || existing.companyId !== companyId || existing.ownerType !== ownerType ||
      (ownerType === "guide" && existing.guideId !== guideId)) {
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

/**
 * TODO: replace with Supabase query once the project exists:
 *   supabase.from('recommendations').delete().eq('id', id)
 */
export async function deleteRecommendation(actor: StudioActor, id: string): Promise<void> {
  const idx = fakeStore.recommendations.findIndex((r) => r.id === id);
  if (idx === -1) return;
  const rec = fakeStore.recommendations[idx];

  const allowed =
    actor.role === "admin" ||
    (actor.role === "company" && rec.companyId === actor.companyId && rec.ownerType === "company") ||
    (actor.role === "guide" &&
      rec.companyId === actor.companyId &&
      rec.ownerType === "guide" &&
      rec.guideId === actor.guideId);

  if (!allowed) {
    throw new StudioPermissionError(`Actor may not delete recommendation ${id}.`);
  }
  fakeStore.recommendations.splice(idx, 1);
}

/** Guides belonging to a company (Studio "Guides" tab, PRD §7.3). Admin may pass any companyId; company/guide are restricted to their own. */
export async function getGuidesForCompany(
  actor: StudioActor,
  companyId: string,
): Promise<GuideRecord[]> {
  assertCompanyScope(actor, companyId);
  return fakeStore.guides.filter((g) => g.companyId === companyId);
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
 * real and immediately shareable even though there is no backend yet to
 * redeem the token against (see src/app/studio/join/[token]/page.tsx).
 * Company (or admin) only — mirrors company_manage_guides in the RLS policy
 * file; a guide cannot invite another guide.
 *
 * TODO: replace with Supabase query once the project exists:
 *   supabase.from('guides').insert({ ... })
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

/**
 * Sets a guide's status (Studio "Guides" tab deactivate/reactivate, PRD
 * §7.3). Company (or admin) only — a guide cannot deactivate themself (or
 * anyone else) through this path. Clears the invite token once a guide
 * leaves "invited", since nothing should still be able to redeem it.
 *
 * TODO: replace with Supabase query once the project exists:
 *   supabase.from('guides').update({ status: ... }).eq('id', guideId)
 */
export async function setGuideStatus(
  actor: StudioActor,
  guideId: string,
  status: GuideStatus,
): Promise<GuideRecord> {
  if (actor.role !== "company" && actor.role !== "admin") {
    throw new StudioPermissionError("Only a company (or admin) may change a guide's status.");
  }
  const guide = fakeStore.guides.find((g) => g.id === guideId);
  if (!guide) throw new StudioPermissionError(`Guide ${guideId} not found.`);
  assertCompanyScope(actor, guide.companyId);

  guide.status = status;
  if (status !== "invited") guide.inviteToken = null;
  guide.updatedAt = new Date().toISOString();
  return guide;
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
 * TODO: replace with Supabase query once the project exists:
 *   supabase.from('guides').update({ ... }).eq('id', guideId)
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
  const guide = fakeStore.guides.find((g) => g.id === guideId);
  if (!guide) throw new StudioPermissionError(`Guide ${guideId} not found.`);

  if (input.avatarUrl !== undefined) guide.avatarUrl = input.avatarUrl;
  if (input.welcomeMessage !== undefined) guide.welcomeMessage = input.welcomeMessage;
  guide.updatedAt = new Date().toISOString();
  return guide;
}

/** Admin-owned boat tour catalog (PRD §8.2) plus this tenant's featured flag, for the company's "Boat tours" tab (PRD §7.5). */
export async function getBoatCatalogForStudio(
  actor: StudioActor,
): Promise<Array<BoatTourRecord & { isFeatured: boolean; featuredPosition: number }>> {
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

/**
 * Toggles/reorders a featured boat tour. Company-only (a guide sees this
 * list read-only per PRD §6.4).
 *
 * TODO: replace with Supabase query once the project exists:
 *   supabase.from('company_boat_features').upsert({ ... })
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
}

/** Full company row for Studio's Branding tab (PRD §7.2). */
export async function getCompanyForStudio(
  actor: StudioActor,
  companyId: string,
): Promise<CompanyRecord | null> {
  assertCompanyScope(actor, companyId);
  return fakeStore.companies.find((c) => c.id === companyId) ?? null;
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
 * TODO: replace with Supabase query once the project exists:
 *   supabase.from('companies').update({ ... }).eq('id', companyId)
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

  const company = fakeStore.companies.find((c) => c.id === companyId);
  if (!company) throw new StudioPermissionError(`Company ${companyId} not found.`);

  Object.assign(company, input, { updatedAt: new Date().toISOString() });
  return company;
}

// =============================================================================
// Analytics rollups (PRD §6.4, §7.1, §7.7, §8.4).
// =============================================================================

function inRange(occurredAt: string, range?: AnalyticsRange): boolean {
  if (!range) return true;
  const t = new Date(occurredAt).getTime();
  return t >= range.from.getTime() && t < range.to.getTime();
}

/**
 * TODO: replace with Supabase query once the project exists:
 *   supabase.rpc('company_analytics_summary', { p_company_id, p_from, p_to })
 */
export async function getCompanyAnalyticsSummary(
  actor: StudioActor,
  companyId: string,
  range?: AnalyticsRange,
): Promise<AnalyticsSummaryRow[]> {
  assertCompanyScope(actor, companyId);
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

/**
 * TODO: replace with Supabase query once the project exists:
 *   supabase.rpc('guide_analytics_summary', { p_guide_id, p_from, p_to })
 */
export async function getGuideAnalyticsSummary(
  actor: StudioActor,
  guideId: string,
  range?: AnalyticsRange,
): Promise<AnalyticsSummaryRow[]> {
  if (actor.role === "guide" && actor.guideId !== guideId) {
    throw new StudioPermissionError(`Guide actor may not read analytics for guide ${guideId}.`);
  }
  if (actor.role === "company") {
    const guide = fakeStore.guides.find((g) => g.id === guideId);
    if (!guide || guide.companyId !== actor.companyId) {
      throw new StudioPermissionError(`Company actor may not read analytics for guide ${guideId}.`);
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

/**
 * Admin-only, platform-wide (PRD §8.4).
 *
 * TODO: replace with Supabase query once the project exists:
 *   supabase.rpc('admin_platform_analytics', { p_from, p_to })
 */
export async function getPlatformAnalyticsSummary(
  actor: StudioActor,
  range?: AnalyticsRange,
): Promise<Array<AnalyticsSummaryRow & { companyId: string; companyName: string }>> {
  if (actor.role !== "admin") {
    throw new StudioPermissionError("Only admin may read platform-wide analytics.");
  }
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

// =============================================================================
// Admin-only reads/writes (PRD §8).
// =============================================================================

/** TODO: replace with Supabase query once the project exists: supabase.from('companies').select() */
export async function listCompanies(actor: StudioActor): Promise<CompanyRecord[]> {
  if (actor.role !== "admin") throw new StudioPermissionError("Only admin may list all companies.");
  return [...fakeStore.companies];
}

/** TODO: replace with Supabase query once the project exists: supabase.from('boat_tours').select() */
export async function listBoatTourCatalog(actor: StudioActor): Promise<BoatTourRecord[]> {
  if (actor.role !== "admin") throw new StudioPermissionError("Only admin may manage the boat tour catalog.");
  return [...fakeStore.boatTours].sort((a, b) => a.position - b.position);
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
 * `bookingUrl` is the same field the guest booking hand-off already reads
 * (src/lib/guestActions.ts -> src/lib/boatBookingHandoff.ts): its role there
 * is to mark a pin as bookable at all, since the actual redirect URL is
 * built fresh at click-time by src/lib/attribution.ts's buildBookingUrl()
 * (base URL + this tour's id + a click id), not by reading this field's
 * contents. It's still stored and admin-editable as the tour's canonical
 * boatlocal.nl reference URL, following the convention already established
 * in the seed data (src/lib/data.ts): "https://boatlocal.nl/tours/<slug>".
 *
 * TODO: replace with Supabase query once the project exists:
 *   supabase.from('boat_tours').upsert({ ... }).select().single()
 */
export async function saveBoatTour(
  actor: StudioActor,
  input: SaveBoatTourInput,
): Promise<BoatTourRecord> {
  assertAdmin(actor, "create or edit boat tours");

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

/**
 * Removes a boat tour from the platform catalog entirely (PRD §8.2,
 * admin-only). Every company's `company_boat_features` row for this tour is
 * removed too, mirroring the schema's `ON DELETE CASCADE` on that FK (see
 * supabase/migrations/20260805063610_init_schema.sql) — a company should
 * never be left featuring a tour that no longer exists.
 *
 * TODO: replace with Supabase query once the project exists:
 *   supabase.from('boat_tours').delete().eq('id', id)
 *   (company_boat_features rows cascade automatically at the DB layer)
 */
export async function deleteBoatTour(actor: StudioActor, id: string): Promise<void> {
  assertAdmin(actor, "delete boat tours");
  const idx = fakeStore.boatTours.findIndex((t) => t.id === id);
  if (idx === -1) return;
  fakeStore.boatTours.splice(idx, 1);
  fakeStore.companyBoatFeatures = fakeStore.companyBoatFeatures.filter(
    (f) => f.boatTourId !== id,
  );
}

/**
 * Sets a tour's catalog-wide position directly (Admin's up/down reorder
 * control) — a narrower sibling of saveBoatTour for when only the order
 * changes, so a quick reorder click doesn't need to resend every other
 * field. Distinct from `company_boat_features.position`, which is each
 * tenant's own featured order (see getBoatTours' comment above) and is
 * changed via setBoatFeature, not this.
 *
 * TODO: replace with Supabase query once the project exists:
 *   supabase.from('boat_tours').update({ position }).eq('id', id)
 */
export async function setBoatTourPosition(
  actor: StudioActor,
  id: string,
  position: number,
): Promise<void> {
  assertAdmin(actor, "reorder the boat tour catalog");
  const tour = fakeStore.boatTours.find((t) => t.id === id);
  if (!tour) throw new StudioPermissionError(`Boat tour ${id} not found.`);
  tour.position = position;
  tour.updatedAt = new Date().toISOString();
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
 * Admin's "create/onboard a company" flow (PRD §8.3: "create/onboard a
 * company (assign subdomain — §13.1)"). Rejects a subdomain already taken
 * by another tenant, the same way a real insert would violate the
 * `companies.subdomain` unique constraint (see
 * supabase/migrations/20260805063610_init_schema.sql) and roll back —
 * thrown as a plain Error, not StudioPermissionError, since this is a data
 * conflict, not a permission problem.
 *
 * TODO: replace with Supabase query once the project exists:
 *   supabase.from('companies').insert({ ... }).select().single()
 *   (subdomain's `unique` constraint does the duplicate check for free;
 *   the pre-check here would become a friendlier error message on top of
 *   catching the resulting Postgres error code, not a replacement for it)
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

  const subdomain = slugify(input.subdomain?.trim() || name);
  // slugify() only filters characters — it does not enforce the 63-char DNS
  // label limit (see its own doc comment), so a long enough name/subdomain
  // input can still produce an invalid label. isUrlSafeSubdomain exists
  // specifically for this and must run before the label is accepted, not
  // just be available for someone else to remember to call.
  if (!isUrlSafeSubdomain(subdomain)) {
    throw new Error(
      `"${subdomain}" is not a valid subdomain (1-63 lowercase letters/digits/hyphens, can't start or end with a hyphen).`,
    );
  }
  // Reject a label that would collide with Boat Local's own fixed hosts
  // (admin.boatlocal.nl, studio.boatlocal.nl — PRD §13.1) or a common,
  // confusing label (www, api, the wildcard's own "app") before ever
  // touching the uniqueness check below — see src/lib/slug.ts.
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    throw new Error(`"${subdomain}" is a reserved subdomain and can't be assigned to a company.`);
  }
  const taken = fakeStore.companies.some((c) => c.subdomain === subdomain);
  if (taken) {
    throw new Error(`Subdomain "${subdomain}" is already in use by another company.`);
  }

  const created = new Date().toISOString();
  const record: CompanyRecord = {
    id: fakeId("company"),
    name,
    subdomain,
    companyType: input.companyType,
    appName: name,
    brandPrimary: ONBOARDING_DEFAULT_BRAND.primary,
    brandPrimaryDark: ONBOARDING_DEFAULT_BRAND.primaryDark,
    brandAccent: ONBOARDING_DEFAULT_BRAND.accent,
    brandSurround: ONBOARDING_DEFAULT_BRAND.surround,
    logoUrl: null,
    campaignParams: null,
    googleReviewUrl: null,
    tripadvisorReviewUrl: null,
    status: input.status ?? "setup",
    createdAt: created,
    updatedAt: created,
  };
  fakeStore.companies.push(record);
  return record;
}

/**
 * Admin flips a company between setup/live/suspended (PRD §2.3, §8.3's
 * "manage" half of the Companies page) after onboarding. Admin-only — a
 * company cannot self-reactivate out of "suspended", matching how a guide
 * cannot self-reactivate in setGuideStatus above.
 *
 * TODO: replace with Supabase query once the project exists:
 *   supabase.from('companies').update({ status: ... }).eq('id', companyId)
 */
export async function setCompanyStatus(
  actor: StudioActor,
  companyId: string,
  status: CompanyStatus,
): Promise<CompanyRecord> {
  if (actor.role !== "admin") {
    throw new StudioPermissionError("Only admin may change a company's status.");
  }
  const company = fakeStore.companies.find((c) => c.id === companyId);
  if (!company) throw new StudioPermissionError(`Company ${companyId} not found.`);

  company.status = status;
  company.updatedAt = new Date().toISOString();
  return company;
}

// Re-exported so callers only need one import for the category lookups they
// often need next to a Place/MapPin (e.g. pin colour). Not a data-access
// concern per se, but keeping it here avoids a second import line at every
// call site that already imports from this module.
export function categoryLabel(id: CategoryId): string {
  return CATEGORY_MAP[id]?.label ?? id;
}

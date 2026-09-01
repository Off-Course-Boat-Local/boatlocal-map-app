// Pure parsing/validation for Admin's "Add / edit admin-curated
// recommendation" form (the new "Admin recommendations for {company}"
// section on the company detail page). This is the ONLY place an
// owner_type='admin' recommendation's own fields can be created or edited —
// see supabase/migrations/20260824090100_admin_recommendations_rls.sql and
// src/lib/data/types.ts's RecommendationOwnerType doc comment for the
// security model these rows exist under.
//
// Deliberately its own module rather than importing
// src/lib/studio/recommendationForm.ts: same "Admin having its own parallel
// modules alongside Studio's, not depending on Studio internals" pattern
// src/lib/admin/boatTourForm.ts's own header comment documents (mirrors
// src/components/studio/RecommendationPhotosField.tsx's mechanics without
// importing it, admin/devAuth.ts beside studio/devAuth.ts, etc.) — and,
// unlike Studio's form, there is no ownerType/guideId to parse here at all:
// every row this form produces is owner_type='admin', guide_id=null, fixed
// by the caller (saveAdminRecommendationAction), never by anything the form
// itself submits.
//
// Also dependency-free w.r.t. Next.js, so it's importable from both the
// Server Action (./adminRecommendationActions.ts) and the Client Component
// form (src/components/admin/AdminRecommendationForm.tsx), and trivially
// unit-testable without mounting anything — same split as boatTourForm.ts
// and Studio's recommendationForm.ts, for the same "a file with a top-level
// 'use server' directive may only export async functions" reason.
//
// NOTE: category options exclude "boats" on purpose, same reasoning as
// Studio's RECOMMENDATION_CATEGORIES — boat tours live in their own table
// (boat_tours), managed only from Admin > Boats, never as a recommendation
// row (recommendation_category_not_boats CHECK enforces this at the DB
// layer too).
//
// NOTE ON GOOGLE PLACES: the house rule against it (still true for address
// entry — this form's AddressField still searches OSM/Photon, same as
// BoatTourForm and Studio's RecommendationForm) was knowingly overridden for
// ONE thing: AdminRecommendationForm.tsx's "Search Google Maps" enrichment
// button (src/lib/admin/googlePlaces.ts), which pulls category/hours/photos
// to speed up curating these rows (founder request, 2026-09-01). That is a
// deliberate, scoped exception — accepting the Google ToS caching/display
// risk googlePlaces.ts's header documents — not a reversal of the rule for
// anything else in the app.

import { CATEGORIES } from "../categories";
import type { CategoryId } from "../types";
import type { SaveRecommendationInput } from "../data/types";

/** Matches Studio's recommendationForm.ts NOTE_MAX_LENGTH — same guideline, same limit. */
export const NOTE_MAX_LENGTH = 280;

/** Founder's explicit "3+ photos" nudge, same threshold Studio and Admin's boat tour form use. */
export const PHOTO_NUDGE_THRESHOLD = 3;

/** Keeps data-URL payloads (the only "storage" available pre-Supabase) bounded. */
export const MAX_PHOTOS = 8;

/** Every fixed category except "boats" — boat tours are a separate table, never a recommendation. */
export const ADMIN_RECOMMENDATION_CATEGORIES = CATEGORIES.filter((c) => c.id !== "boats");

const ADMIN_RECOMMENDATION_CATEGORY_IDS = new Set<string>(
  ADMIN_RECOMMENDATION_CATEGORIES.map((c) => c.id),
);

export type ParseAdminRecommendationFormResult =
  | { ok: true; value: Omit<SaveRecommendationInput, "companyId"> }
  | { ok: false; error: string };

function isFiniteNumber(n: number): boolean {
  return Number.isFinite(n);
}

/**
 * Parses and validates a <form>'s FormData into a SaveRecommendationInput
 * (minus companyId, which the Server Action binds server-side from the page
 * context — never trusted from client-submitted form fields). Pure — no
 * I/O, no auth, no permission check (that's saveRecommendation's job in
 * src/lib/data/source.ts). Returns a human-readable error string rather
 * than throwing, so the Server Action can hand it straight back to
 * useActionState.
 */
export function parseAdminRecommendationForm(
  formData: FormData,
): ParseAdminRecommendationFormResult {
  const id = String(formData.get("id") ?? "").trim() || undefined;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Enter a name." };

  const categories = formData
    .getAll("categories")
    .map((c) => String(c))
    .filter((c) => ADMIN_RECOMMENDATION_CATEGORY_IDS.has(c)) as CategoryId[];
  if (categories.length === 0) {
    return { ok: false, error: "Choose at least one category." };
  }

  const area = String(formData.get("area") ?? "").trim();
  if (!area) return { ok: false, error: "Enter an area or neighbourhood." };

  const address = String(formData.get("address") ?? "").trim();
  if (!address) return { ok: false, error: "Enter an address." };

  const lngRaw = String(formData.get("lng") ?? "").trim();
  const latRaw = String(formData.get("lat") ?? "").trim();
  const lng = Number(lngRaw);
  const lat = Number(latRaw);
  if (!lngRaw || !latRaw || !isFiniteNumber(lng) || !isFiniteNumber(lat)) {
    return { ok: false, error: "Search for the address and pick a suggestion to place the pin." };
  }
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return { ok: false, error: "That pin is off the map — search again and re-place it." };
  }

  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { ok: false, error: "Enter a note — this is the whole endorsement." };
  if (note.length > NOTE_MAX_LENGTH) {
    return { ok: false, error: `Note must be ${NOTE_MAX_LENGTH} characters or fewer.` };
  }

  const hours = String(formData.get("hours") ?? "").trim();

  const photos = formData
    .getAll("photos")
    .map((p) => String(p))
    .filter((p) => p.length > 0)
    .slice(0, MAX_PHOTOS);

  const visible = formData.get("visible") != null;

  return {
    ok: true,
    value: { id, categories, name, area, address, lng, lat, note, hours, photos, visible },
  };
}

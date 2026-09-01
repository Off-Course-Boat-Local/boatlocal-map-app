// Pure parsing/validation for the Studio "Add / edit place" form (PRD §7.4
// company base list, §6.3 guide personal additions).
//
// Deliberately dependency-free w.r.t. Next.js so it is importable from both
// the Server Action (src/lib/studio/recommendationActions.ts) and the
// Client Component form (src/components/studio/RecommendationForm.tsx) —
// and so it is trivially unit-testable without mounting anything.
//
// NOTE: category options exclude "boats" on purpose. Boat tours live in a
// separate table (boat_tours / company_boat_features) and are managed from
// the Boat tours tab, never from this form — src/lib/data/source.ts's
// saveRecommendation() rejects category "boats" for the same reason; this
// module just keeps the <select> from ever offering it in the first place.
//
// NOTE ON GOOGLE PLACES: the house rule against it (still true for address
// entry — this form's AddressField still searches OSM/Photon) was knowingly
// overridden for ONE thing: RecommendationForm.tsx's "Search Google Maps"
// enrichment button (src/lib/admin/googlePlaces.ts via the Studio-gated
// /api/studio/places/* routes), which pulls category/hours/photos to speed
// up adding a place (founder request, 2026-09-01, extending the same
// exception Admin's recommendation form already had — see
// src/lib/admin/adminRecommendationForm.ts's own "NOTE ON GOOGLE PLACES").
// That is a deliberate, scoped exception — accepting the Google ToS
// caching/display risk googlePlaces.ts's header documents — not a reversal
// of the rule for anything else in the app. Address entry itself is still
// assisted only by src/components/AddressField.tsx's OSM geocoder, which
// drops a draggable pin and submits `lng`/`lat` as hidden fields — the
// parsing below is unchanged by any of this, it still receives the same
// fields it always did.

import { CATEGORIES } from "../categories";
import type { CategoryId } from "../types";
import type { SaveRecommendationInput } from "../data/types";

/** Matches the PRD's ~280 char guide-note guidance. */
export const NOTE_MAX_LENGTH = 280;

/** Founder's explicit direction: nudge toward 3+ photos per listing. */
export const PHOTO_NUDGE_THRESHOLD = 3;

/** Keeps data-URL payloads (the only "storage" available pre-Supabase) bounded. */
export const MAX_PHOTOS = 8;

/** Every fixed category except "boats" — boat tours are a separate table/tab. */
export const RECOMMENDATION_CATEGORIES = CATEGORIES.filter((c) => c.id !== "boats");

const RECOMMENDATION_CATEGORY_IDS = new Set<string>(RECOMMENDATION_CATEGORIES.map((c) => c.id));

export type ParseRecommendationFormResult =
  | { ok: true; value: SaveRecommendationInput }
  | { ok: false; error: string };

function isFiniteNumber(n: number): boolean {
  return Number.isFinite(n);
}

/**
 * Parses and validates a <form>'s FormData into a SaveRecommendationInput.
 * Pure — no I/O, no auth, no permission check (that's saveRecommendation's
 * job in src/lib/data/source.ts). Returns a human-readable error string
 * rather than throwing, so the Server Action can hand it straight back to
 * useActionState.
 */
export function parseRecommendationForm(formData: FormData): ParseRecommendationFormResult {
  const id = String(formData.get("id") ?? "").trim() || undefined;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Enter a name." };

  const categories = formData
    .getAll("categories")
    .map((c) => String(c))
    .filter((c) => RECOMMENDATION_CATEGORY_IDS.has(c)) as CategoryId[];
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
  // Phrased for the person who will actually read it: nobody types these
  // any more, so "enter a valid longitude" would describe a field the form
  // no longer has. An empty lng/lat now means "searched but never picked a
  // suggestion", which is exactly what the message says to go do.
  if (!lngRaw || !latRaw || !isFiniteNumber(lng) || !isFiniteNumber(lat)) {
    return { ok: false, error: "Search for the address and pick a suggestion to place the pin." };
  }
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return { ok: false, error: "That pin is off the map — search again and re-place it." };
  }

  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { ok: false, error: "Enter a personal note — it's the whole endorsement." };
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

// Pure parsing/validation for the Admin "Add / edit boat tour" form (PRD
// §8.2). This is the ONLY place a boat tour can be created or edited —
// Studio's Boat tours tab only toggles/reorders which tours a company
// features (see setBoatFeature in src/lib/data/source.ts); it never touches
// the tour record itself.
//
// Deliberately dependency-free w.r.t. Next.js so it is importable from both
// the Server Action (src/lib/admin/boatTourActions.ts) and the Client
// Component form (src/components/admin/BoatTourForm.tsx), and trivially
// unit-testable without mounting anything — same split as Studio's
// src/lib/studio/recommendationForm.ts, for the same reason: a file with a
// top-level "use server" directive may only export async functions (see
// node_modules/next/dist/docs/01-app/03-api-reference/01-directives/
// use-server.md).
//
// NOTE on "price": the PRD (§8.2) and the founder's brief both call this
// field "price", but the schema (supabase/migrations/
// 20260805063610_init_schema.sql) and the existing seed data (src/lib/
// data.ts) already model it as one free-text field — "meta" — that bundles
// duration, price and any extras guests care about in one guest-facing
// line, e.g. "90 min · €28 pp · drinks incl.". Rather than bolt on a second,
// separate structured price field that could drift out of sync with what
// guests actually see on the pin (src/lib/data.ts's MapPin.meta, rendered
// verbatim), this form edits that same "meta" field directly, labelled
// "Price & duration" — one field, one source of truth, matching the
// existing convention exactly.
//
// NOTE on "booking URL": this field IS what the guest is ultimately
// redirected to — src/lib/attribution.ts's buildBookingUrl appends tracking
// params (ref/date/guests/company/distributor/src) onto exactly this URL at
// click time, rather than building a redirect from some other fixed base
// (see that function's own doc comment for why). For a tour synced from
// BoatLocal's catalogue feed (src/lib/data/source.ts's
// syncCruiseFromBoatLocal), this gets written automatically from their
// `booking_url` and an admin never needs to touch it here; for a manually
// admin-curated tour, it's still a required, validated field — the flag
// that marks a pin as bookable at all.

import type { BoatTourStatus, SaveBoatTourInput } from "../data/types";

/** Matches Studio's recommendationForm.ts NOTE_MAX_LENGTH — same guideline, same limit. */
export const NOTE_MAX_LENGTH = 280;

/** Founder's explicit "3+ photos" nudge, same threshold Studio uses. */
export const PHOTO_NUDGE_THRESHOLD = 3;

/** Keeps data-URL payloads (the only "storage" available pre-Supabase) bounded. */
export const MAX_PHOTOS = 8;

export type ParseBoatTourFormResult =
  | { ok: true; value: SaveBoatTourInput }
  | { ok: false; error: string };

function isFiniteNumber(n: number): boolean {
  return Number.isFinite(n);
}

function isValidAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Parses and validates a <form>'s FormData into a SaveBoatTourInput. Pure —
 * no I/O, no auth, no permission check (that's saveBoatTour's job in
 * src/lib/data/source.ts). Returns a human-readable error string rather
 * than throwing, so the Server Action can hand it straight back to
 * useActionState.
 */
export function parseBoatTourForm(formData: FormData): ParseBoatTourFormResult {
  const id = String(formData.get("id") ?? "").trim() || undefined;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Enter a tour name." };

  const area = String(formData.get("area") ?? "").trim();
  if (!area) return { ok: false, error: "Enter a departure point / area." };

  const lngRaw = String(formData.get("lng") ?? "").trim();
  const latRaw = String(formData.get("lat") ?? "").trim();
  const lng = Number(lngRaw);
  const lat = Number(latRaw);
  if (!lngRaw || !latRaw || !isFiniteNumber(lng) || !isFiniteNumber(lat)) {
    return { ok: false, error: "Enter a valid longitude and latitude." };
  }
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return { ok: false, error: "Longitude must be -180..180 and latitude -90..90." };
  }

  const meta = String(formData.get("meta") ?? "").trim();
  if (!meta) {
    return {
      ok: false,
      error: 'Enter the price & duration line guests see, e.g. "90 min · €28 pp · drinks incl."',
    };
  }

  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { ok: false, error: "Enter a description." };
  if (note.length > NOTE_MAX_LENGTH) {
    return { ok: false, error: `Description must be ${NOTE_MAX_LENGTH} characters or fewer.` };
  }

  const bookingUrl = String(formData.get("bookingUrl") ?? "").trim();
  if (!bookingUrl) return { ok: false, error: "Enter the boatlocal.nl booking URL." };
  if (!isValidAbsoluteUrl(bookingUrl)) {
    return { ok: false, error: "Booking URL must be a valid http(s) URL." };
  }

  const photos = formData
    .getAll("photos")
    .map((p) => String(p))
    .filter((p) => p.length > 0)
    .slice(0, MAX_PHOTOS);

  const positionRaw = String(formData.get("position") ?? "").trim();
  let position: number | undefined;
  if (positionRaw) {
    const parsedPosition = Number(positionRaw);
    if (!isFiniteNumber(parsedPosition) || parsedPosition < 1) {
      return { ok: false, error: "Position must be a positive number." };
    }
    position = parsedPosition;
  }

  const statusRaw = String(formData.get("status") ?? "active");
  const status: BoatTourStatus = statusRaw === "hidden" ? "hidden" : "active";

  return {
    ok: true,
    value: { id, name, area, lng, lat, meta, note, bookingUrl, photos, position, status },
  };
}

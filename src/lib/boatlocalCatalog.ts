// Pure parsing for BoatLocal's cruise catalogue wire shape — the same split
// attribution.ts (pure parsing) / attributionWebhook.ts (signing, needs
// "node:crypto") already uses for the booking webhook, so this file is safe
// to import from anywhere (no secrets, no Node built-ins) and trivially
// unit-testable without a database or a real HTTP call.
//
// Two shapes come from BoatLocal, confirmed in the go-live plan:
//   1. One entry of `GET /api/public/cruises`'s `cruises` array, or a
//      `cruise.activated` webhook's `cruise` field — full shape, parsed by
//      parseBoatLocalCruise into BoatLocalCruise (src/lib/data/types.ts).
//   2. A `cruise.deactivated` webhook's `cruise` field — a deliberately
//      SMALLER shape (just enough to identify which row to hide: id, slug,
//      fareharbor_pk), plus a top-level `reason` — parsed by
//      parseCruiseDeactivatedPayload. This is NOT a BoatLocalCruise and must
//      not be run through parseBoatLocalCruise, which would reject it for
//      missing `name`/`booking_url`/`active`.
//
// The actual DB upsert/hide logic lives in src/lib/data/source.ts
// (syncCruiseFromBoatLocal / deactivateBoatLocalCruise / hideMissingBoatLocalTours) —
// this file only ever turns `unknown` JSON into a typed value or `null`.

import type { BoatLocalCruise, BoatLocalCruiseDeparture } from "./data/types";

/**
 * Parses one `departure` object (added to BoatLocal's catalogue feed after
 * the rest of this integration — see docs/attribution.md; absent entirely
 * from every response as of this parser shipping, since BoatLocal hasn't put
 * it in production yet). Returns null both when the field is simply absent
 * (today's reality) and when it's the explicit `null` BoatLocal sends for
 * the ~4 seasonal/candlelight cruises with neither a Maps link nor an
 * address — syncCruiseFromBoatLocal treats those two cases identically
 * anyway (no location data to use), so this function never needs to
 * distinguish them for its caller.
 *
 * Lenient on `source`: any string is accepted (not just the two values
 * BoatLocal has confirmed today), same "don't reject a good row over one
 * open-ended field" reasoning as `deactivationReason`/`reason` elsewhere in
 * this file. A malformed departure (missing/wrong-typed lat, lng, or
 * address) is treated as "no departure data" rather than rejecting the whole
 * cruise entry over it.
 */
function parseDeparture(json: unknown): BoatLocalCruiseDeparture | null {
  if (typeof json !== "object" || json === null) return null;
  const d = json as Record<string, unknown>;

  const lat = d.lat;
  const lng = d.lng;
  const address = d.address;
  if (typeof lat !== "number" || typeof lng !== "number" || typeof address !== "string" || !address) {
    return null;
  }

  const source = typeof d.source === "string" ? d.source : null;
  return { lat, lng, address, source };
}

/**
 * Parses one catalogue-feed entry (or a `cruise.activated` webhook's
 * `cruise` field). Returns null for anything that doesn't even have the
 * fields BoatLocal's contract says are always present (id, name, booking_url,
 * active) — reconcileBoatLocalCatalog treats a batch of all-null parses as a
 * failed sync (the feed's shape drifted), not "zero cruises today."
 *
 * fareharborPk/slug are nullable in the type (per the confirmed schema they
 * shouldn't ever actually be null, but syncCruiseFromBoatLocal already has a
 * documented boatlocal_id fallback for exactly that case, so this stays
 * lenient here rather than rejecting an otherwise-good row over one
 * unexpectedly-null field).
 */
export function parseBoatLocalCruise(json: unknown): BoatLocalCruise | null {
  if (typeof json !== "object" || json === null) return null;
  const j = json as Record<string, unknown>;

  const id = j.id;
  const name = j.name;
  const bookingUrl = j.booking_url;
  const active = j.active;
  if (
    typeof id !== "number" ||
    typeof name !== "string" ||
    !name ||
    typeof bookingUrl !== "string" ||
    !bookingUrl ||
    typeof active !== "boolean"
  ) {
    return null;
  }

  const fareharborPk = typeof j.fareharbor_pk === "number" ? j.fareharbor_pk : null;
  const slug = typeof j.slug === "string" && j.slug ? j.slug : null;
  const cruiseType = typeof j.cruise_type === "string" ? j.cruise_type : null;
  const cruiseDuration = typeof j.cruise_duration === "string" ? j.cruise_duration : null;
  // Tolerant like every other optional field: missing, non-string, or
  // empty/whitespace-only all mean "no headline" (null), never a rejected
  // row. Kept verbatim otherwise — syncCruiseFromBoatLocal compares it
  // byte-for-byte against the row's note/boatlocal_headline.
  const headline = typeof j.headline === "string" && j.headline.trim() !== "" ? j.headline : null;
  const startingPrice = typeof j.starting_price === "number" ? j.starting_price : null;
  const currency = typeof j.currency === "string" ? j.currency : null;
  const images = Array.isArray(j.images) ? j.images.filter((i): i is string => typeof i === "string") : [];
  const updatedAt = typeof j.updated_at === "string" ? j.updated_at : null;
  const departure = parseDeparture(j.departure);

  return {
    id,
    fareharborPk,
    slug,
    name,
    cruiseType,
    cruiseDuration,
    headline,
    startingPrice,
    currency,
    images,
    bookingUrl,
    active,
    updatedAt,
    departure,
  };
}

export interface CruiseDeactivatedPayload {
  cruise: {
    id: number;
    slug: string | null;
    fareharborPk: number | null;
  };
  /** "admin_disabled" | "removed_from_fareharbor" per BoatLocal's contract — kept as a plain string, not a union, since treating the two differently is an explicitly open question (see docs/attribution.md). */
  reason: string | null;
}

/** Parses a `cruise.deactivated` webhook body's `cruise`/`reason` fields — see this file's header comment for why this is not parseBoatLocalCruise. */
export function parseCruiseDeactivatedPayload(json: unknown): CruiseDeactivatedPayload | null {
  if (typeof json !== "object" || json === null) return null;
  const j = json as Record<string, unknown>;

  const cruiseJson = j.cruise;
  if (typeof cruiseJson !== "object" || cruiseJson === null) return null;
  const c = cruiseJson as Record<string, unknown>;

  const id = c.id;
  if (typeof id !== "number") return null;

  const fareharborPk = typeof c.fareharbor_pk === "number" ? c.fareharbor_pk : null;
  const slug = typeof c.slug === "string" && c.slug ? c.slug : null;
  const reason = typeof j.reason === "string" ? j.reason : null;

  return { cruise: { id, slug, fareharborPk }, reason };
}

// Straight-line distance + honest walking estimates.
//
// WHY THIS EXISTS
// ---------------
// The app deliberately does not pay for a routing API. Instead we compute a
// great-circle distance, pad it for the fact that Amsterdam is a city of
// canals, and present the result as an *estimate* — never as a route.
//
// Everything here is pure. No React, no browser APIs, no network. That is on
// purpose: these are the numbers a guest reads on a card, so they need to be
// trivially testable and trivially tunable.

/** Minimal geographic point. Matches the shape MapLibre uses (lng first). */
export interface LngLat {
  lng: number;
  lat: number;
}

/** IUGG mean Earth radius in metres. */
export const EARTH_RADIUS_METERS = 6_371_008.8;

/**
 * Detour factor applied to straight-line distance.
 *
 * A straight line in central Amsterdam crosses canals, and there is not always
 * a bridge where you want one. Real walking routes are therefore longer than
 * the crow flies. Measuring a handful of centre pairs in Google Maps puts the
 * real ratio somewhere around 1.15–1.30 depending on how many gracht crossings
 * the route needs.
 *
 * We use 1.4 — deliberately *above* the measured range. The failure we care
 * about is a guest being told "5 minutes" and walking for 12. Over-estimating
 * is the safe direction: arriving early is never a complaint.
 *
 * Tune this in one place. Nothing else in the codebase should hard-code it.
 */
export const AMSTERDAM_DETOUR_FACTOR = 1.4;

/** Comfortable tourist walking pace, km/h. Not a fitness pace. */
export const WALKING_SPEED_KMH = 5;

/**
 * Below this padded distance we stop quoting a walking time at all. At 60 m
 * the honest answer is "look up", not "one minute". */
export const RIGHT_HERE_METERS = 80;

/** Display granularity. 700 m, not 683 m — false precision reads as a promise. */
export const METERS_ROUNDING_STEP = 50;

const toRadians = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle ("as the crow flies") distance between two points, in metres.
 *
 * @example haversineMeters({ lng: 4.8936, lat: 52.3731 }, { lng: 4.8852, lat: 52.36 }) // ~1566
 */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Straight-line distance padded by {@link AMSTERDAM_DETOUR_FACTOR}. This is
 * the number every user-facing string is built from — never the raw haversine.
 */
export function walkingDistanceMeters(a: LngLat, b: LngLat): number {
  return haversineMeters(a, b) * AMSTERDAM_DETOUR_FACTOR;
}

/**
 * Walking time in whole minutes for a given distance.
 *
 * Rounds *up*. A guest who is told 9 minutes and arrives in 8 is pleased; the
 * reverse is a broken promise. Never returns less than 1.
 */
export function walkingMinutes(meters: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return 1;
  const metersPerMinute = (WALKING_SPEED_KMH * 1000) / 60; // 83.33
  return Math.max(1, Math.ceil(meters / metersPerMinute));
}

/** Rounds to the nearest {@link METERS_ROUNDING_STEP}, never below one step. */
export function roundMeters(meters: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return METERS_ROUNDING_STEP;
  return Math.max(
    METERS_ROUNDING_STEP,
    Math.round(meters / METERS_ROUNDING_STEP) * METERS_ROUNDING_STEP,
  );
}

/**
 * Formats an already-padded distance for display.
 *
 * Rules:
 *  - metres are rounded to the nearest 50 first, and the minutes are then
 *    derived from the *rounded* number so the two halves of the string always
 *    agree with each other;
 *  - under ~80 m we say "Right here" rather than quoting a minute;
 *  - under 1 km we show metres, at or above 1 km we show one decimal of km;
 *  - everything else is prefixed with "~" because it is an estimate.
 *
 * @example formatWalkFromMeters(700)  // "~9 min walk · 700 m"
 * @example formatWalkFromMeters(2100) // "~26 min walk · 2.1 km"
 * @example formatWalkFromMeters(40)   // "Right here · 50 m"
 */
export function formatWalkFromMeters(meters: number): string {
  const parts = walkEstimateParts(meters);
  if (parts.kind === "rightHere") {
    return parts.metersLabel ? `Right here · ${parts.metersLabel}` : "Right here";
  }
  return `~${parts.minutes} min walk · ${parts.distanceLabel}`;
}

/**
 * The structured pieces behind {@link formatWalkFromMeters} — same banding,
 * rounding and unit rules, but with the English wording left OUT, so the
 * guest UI can assemble the sentence per locale (src/lib/i18n) while the
 * numbers stay in exactly one place. formatWalkFromMeters is implemented on
 * top of this, so the two can never drift.
 */
export type WalkEstimateParts =
  | {
      kind: "rightHere";
      /** e.g. "50 m" — null under ~25 m, where quoting any number invents precision. */
      metersLabel: string | null;
    }
  | { kind: "walk"; minutes: number; distanceLabel: string };

export function walkEstimateParts(meters: number): WalkEstimateParts {
  if (meters < RIGHT_HERE_METERS) {
    // Below ~25 m we are inside GPS noise. Quoting any number would be
    // inventing precision we do not have.
    if (meters < 25) return { kind: "rightHere", metersLabel: null };
    // Inside the rest of the band a 50 m step would round 79 m up to 100 m,
    // which contradicts the band it is in. Use a 25 m step, capped at 75.
    const close = Math.min(75, Math.round(meters / 25) * 25);
    return { kind: "rightHere", metersLabel: `${close} m` };
  }

  const rounded = roundMeters(meters);
  const minutes = walkingMinutes(rounded);

  const distanceLabel =
    rounded < 1000 ? `${rounded} m` : `${(rounded / 1000).toFixed(1)} km`;
  return { kind: "walk", minutes, distanceLabel };
}

/**
 * Same shape and banding as {@link walkEstimateParts}, but for a REAL
 * routed distance/duration (src/lib/walkingRoute.ts's Routes API result)
 * rather than a padded straight-line guess — the guest map prefers this
 * once a route has actually loaded (see GuestMapScreen.tsx), falling back
 * to walkEstimateParts while it's still in flight or if the fetch failed.
 *
 * The one real difference from walkEstimateParts: minutes come from
 * Google's own walking-time model (durationSeconds), not this file's fixed
 * WALKING_SPEED_KMH assumption — that assumption exists specifically to
 * approximate what a real route would say, so a real route's own answer is
 * strictly more accurate than re-deriving one from its distance.
 */
export function walkEstimatePartsFromRoute(
  distanceMeters: number,
  durationSeconds: number,
): WalkEstimateParts {
  if (distanceMeters < RIGHT_HERE_METERS) {
    if (distanceMeters < 25) return { kind: "rightHere", metersLabel: null };
    const close = Math.min(75, Math.round(distanceMeters / 25) * 25);
    return { kind: "rightHere", metersLabel: `${close} m` };
  }

  const rounded = roundMeters(distanceMeters);
  const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
  const distanceLabel = rounded < 1000 ? `${rounded} m` : `${(rounded / 1000).toFixed(1)} km`;
  return { kind: "walk", minutes, distanceLabel };
}

/**
 * The string shown on a place card: padded straight-line distance rendered as
 * an approximate walking time.
 *
 * @example formatWalk(dam, rijksmuseum) // "~27 min walk · 2.2 km"
 */
export function formatWalk(a: LngLat, b: LngLat): string {
  return formatWalkFromMeters(walkingDistanceMeters(a, b));
}

/**
 * Beyond this padded distance a straight line stops being a mild
 * approximation. Dam Square to NDSM Werf is 3.1 km as the crow flies and the
 * crow flies straight over the IJ — a body of water with no bridge at all,
 * only a ferry. The detour factor cannot model that, so past this threshold
 * the copy stops implying "just walk towards it".
 */
export const LONG_WALK_METERS = 2500;

/**
 * Short qualifier to sit next to {@link formatWalk} in the UI. Kept here so the
 * wording that makes the estimate honest lives next to the maths that makes it
 * an estimate.
 */
export const WALK_ESTIMATE_CAVEAT =
  "Straight-line estimate — canals may add a detour";

export const LONG_WALK_CAVEAT =
  "Straight-line estimate — the real route may cross water. Check directions.";

/** Picks the caveat that matches the distance. */
export function walkCaveat(meters: number): string {
  return meters >= LONG_WALK_METERS ? LONG_WALK_CAVEAT : WALK_ESTIMATE_CAVEAT;
}

/** Caveat for a pair of points, using the padded distance. */
export function walkCaveatFor(a: LngLat, b: LngLat): string {
  return walkCaveat(walkingDistanceMeters(a, b));
}

/**
 * Initial compass bearing from a to b, in degrees clockwise from true north
 * (0–360). Feeds the direction-to-walk arrow in GuestNavigationScreen —
 * unlike the distance helpers above this drives a rotation, not a number a
 * guest reads, so it is never padded or rounded.
 */
export function bearingDegrees(a: LngLat, b: LngLat): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLng = toRadians(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

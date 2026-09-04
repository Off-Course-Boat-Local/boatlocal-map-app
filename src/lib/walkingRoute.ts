// Real walking-route lookups via Google's Routes API (server-only — the API
// key never reaches the browser; the client fetches through
// /api/guest/walking-route instead).
//
// WHY THIS EXISTS NOW (2026-09-01): the guest map used to show a dotted
// straight-line "bearing" between the guest and a selected place —
// deliberately not a real route, and deliberately never solid, because a
// straight line in Amsterdam routinely crosses a canal with no bridge (see
// DirectionLine.tsx's older header comment, still true of the geometry
// problem, just no longer the whole story). A real routed line fixes that,
// but Google's Routes API policy requires results DISPLAYED ON A MAP to be
// shown on a Google Map — which is the actual reason this app's map itself
// switched from MapLibre+OpenFreeMap to the Google Maps JavaScript API (see
// BaseMap.tsx's header comment). This module is the other half of that
// change: the route data the now-compliant map renders.
//
// Also the source of real walking distance/duration for the guest map's
// distance pill (replacing src/lib/distance.ts's straight-line estimate
// when a real route is available), for arrival detection driving the
// review-prompt banner, and — with `includeSteps` — the turn-by-turn
// instructions behind GuestNavigationScreen.tsx's in-app walking directions
// (replacing the old hand-off to an external Maps app entirely; see that
// component's header comment).
//
// COST: Compute Routes (Basic/Essentials, walking, no traffic features) is
// billed per request — roughly $5 per 1,000 as of this writing, with a
// $200/month Maps Platform credit shared across every Google Maps API this
// project uses. Extra response fields (like steps) don't change the
// SKU/price on their own — only requesting an advanced feature (traffic
// awareness, etc.) would. Fetched once per pin selection for the map line
// (DirectionLine.tsx), and once more if a guest actually starts in-app
// navigation (GuestNavigationScreen.tsx) — never on every GPS tick.

import "server-only";

import { computeRoutes, parseSeconds, type RawRouteStep } from "./googleRoutes";
import { decodePolyline } from "./polyline";

export interface WalkingRouteStep {
  /** Human-readable turn instruction, e.g. "Turn right onto Mr. Visserplein". */
  instruction: string;
  /** Google's maneuver enum, e.g. "TURN_RIGHT", "DEPART", "ARRIVE" — see GuestNavigationScreen.tsx's icon mapping for the values actually handled. */
  maneuver: string;
  /**
   * Always "WALK" here. Emitted even though it's constant, so the client's
   * step type can keep `travelMode` NON-optional across both route kinds —
   * an optional one is a foot-gun: every consumer has to remember to test
   * `!== "TRANSIT"` rather than the more natural `=== "WALK"`, which would
   * be silently false for every walking route.
   */
  travelMode: "WALK";
  distanceMeters: number;
  durationSeconds: number;
  startLocation: { lng: number; lat: number };
  endLocation: { lng: number; lat: number };
}

export interface WalkingRoute {
  distanceMeters: number;
  durationSeconds: number;
  /** [lng, lat] pairs, decoded from Google's polyline encoding — ready to feed straight into a google.maps.Polyline path. */
  path: Array<{ lng: number; lat: number }>;
  /** Only populated when `includeSteps` was passed to getWalkingRoute. */
  steps: WalkingRouteStep[];
}

/**
 * Fetches a real walking route between two points. Returns null (never
 * throws) on any failure — a bad/missing route is not worth crashing a map
 * (or a navigation screen) over; callers fall back accordingly (the map to
 * its old straight-line estimate, the navigation screen to an error state
 * with a link out to Google Maps).
 */
export async function getWalkingRoute(
  origin: { lng: number; lat: number },
  destination: { lng: number; lat: number },
  options: { includeSteps?: boolean; languageCode?: string } = {},
): Promise<WalkingRoute | null> {
  const fieldMask = options.includeSteps
    ? "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline," +
      "routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration," +
      "routes.legs.steps.navigationInstruction,routes.legs.steps.startLocation," +
      "routes.legs.steps.endLocation"
    : "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline";

  // Google localises the turn instructions itself when told which language
  // the guest is reading in — cheaper and better than translating "Turn
  // right onto Prinsengracht" in five dictionaries.
  const route = await computeRoutes({
    origin,
    destination,
    travelMode: "WALK",
    fieldMask,
    languageCode: options.languageCode,
  });

  const encoded = route?.polyline?.encodedPolyline;
  if (!route || !encoded) return null;

  const rawSteps = route.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
  const steps: WalkingRouteStep[] = rawSteps
    .filter(
      (s: RawRouteStep) =>
        s.navigationInstruction?.instructions && s.startLocation?.latLng && s.endLocation?.latLng,
    )
    .map((s: RawRouteStep) => ({
      instruction: s.navigationInstruction!.instructions!,
      maneuver: s.navigationInstruction!.maneuver ?? "STRAIGHT",
      travelMode: "WALK" as const,
      distanceMeters: s.distanceMeters ?? 0,
      durationSeconds: parseSeconds(s.staticDuration),
      startLocation: { lng: s.startLocation!.latLng!.longitude!, lat: s.startLocation!.latLng!.latitude! },
      endLocation: { lng: s.endLocation!.latLng!.longitude!, lat: s.endLocation!.latLng!.latitude! },
    }));

  return {
    distanceMeters: route.distanceMeters ?? 0,
    durationSeconds: parseSeconds(route.duration),
    path: decodePolyline(encoded),
    steps,
  };
}

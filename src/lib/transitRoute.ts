// Real public-transport route lookups via Google's Routes API — the transit
// sibling of src/lib/walkingRoute.ts (see that file's header for the
// server-only/compliance/never-throws rationale, all identical here).
//
// WHY THIS EXISTS (2026-09-04): founder wants a genuine public-transport
// alternative alongside the existing in-app "Walking directions", not just
// an external Google Maps hand-off — see GuestNavigationScreen.tsx's header
// for how the two modes share one screen.
//
// COST: Compute Routes with `travelMode: TRANSIT` bills under a different,
// higher-priced tier ("Advanced") than the plain-walking "Basic" tier
// walkingRoute.ts uses — confirm this is enabled/budgeted on the shared
// Maps Platform project (see .env.local's GOOGLE_PLACES_API_KEY comment)
// before relying on this in production.
//
// A transit itinerary comes back as ONE flat list of steps spanning
// multiple `travelMode`s (walk to the stop, ride the tram, walk from the
// stop) — not a separate "transit route" object. That's what lets
// GuestNavigationScreen's step-list/camera/progress logic stay mode-
// agnostic; only step *rendering* branches on `travelMode`.

import "server-only";

import { computeRoutes, parseSeconds, type RawRouteStep } from "./googleRoutes";
import { decodePolyline } from "./polyline";

export interface TransitLine {
  /** Full line name, e.g. "Tram 14". */
  name: string | null;
  /** Short form Google supplies for badges, e.g. "14". */
  shortName: string | null;
  /** Hex colour Google associates with this line/operator, e.g. "#E4572E" — null if Google didn't supply one. */
  color: string | null;
  /** The colour Google says to draw ON TOP of `color`. Requested because operator colours are arbitrary and plenty are light (NS yellow, #FFC917) — hardcoding white text would make the badge unreadable on those. */
  textColor: string | null;
  /** Google's vehicle-type enum, e.g. "TRAM", "BUS", "SUBWAY", "FERRY" — see GuestNavigationScreen.tsx's icon mapping for the values actually handled. */
  vehicleType: string | null;
}

export interface TransitStepDetails {
  line: TransitLine;
  /** Direction shown on the vehicle, e.g. "Muiderpoortstation". */
  headsign: string | null;
  stopCount: number | null;
  /** Where to board, e.g. "Nieuwmarkt". */
  departureStop: string | null;
  /** Where to get off — the single most load-bearing fact on a transit leg. */
  arrivalStop: string | null;
  /** ISO 8601 — Google's own scheduled/predicted time. */
  departureTime: string | null;
  arrivalTime: string | null;
}

export interface TransitRouteStep {
  /** Populated for WALK sub-legs only (Google doesn't supply a plain-English instruction for TRANSIT steps — GuestNavigationScreen composes that itself from `transitDetails`). */
  instruction: string | null;
  maneuver: string;
  /** Non-optional on purpose — see WalkingRouteStep.travelMode's comment for why an optional one is a foot-gun. */
  travelMode: "WALK" | "TRANSIT";
  transitDetails: TransitStepDetails | null;
  distanceMeters: number;
  durationSeconds: number;
  startLocation: { lng: number; lat: number };
  endLocation: { lng: number; lat: number };
}

export interface TransitRoute {
  distanceMeters: number;
  durationSeconds: number;
  /** [lng, lat] pairs, decoded from Google's polyline encoding — same shape as WalkingRoute.path. */
  path: Array<{ lng: number; lat: number }>;
  steps: TransitRouteStep[];
}

interface RawTransitLine {
  name?: string;
  nameShort?: string;
  color?: string;
  textColor?: string;
  vehicle?: { type?: string };
}

interface RawTransitDetails {
  transitLine?: RawTransitLine;
  headsign?: string;
  stopCount?: number;
  stopDetails?: {
    departureTime?: string;
    arrivalTime?: string;
    departureStop?: { name?: string };
    arrivalStop?: { name?: string };
  };
}

/** The shared raw step shape, narrowed to the transitDetails this module actually parses. */
type RawStep = Omit<RawRouteStep, "transitDetails"> & { transitDetails?: RawTransitDetails };

const FIELD_MASK = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.polyline.encodedPolyline",
  "routes.legs.steps.travelMode",
  "routes.legs.steps.distanceMeters",
  "routes.legs.steps.staticDuration",
  "routes.legs.steps.navigationInstruction",
  "routes.legs.steps.startLocation",
  "routes.legs.steps.endLocation",
  "routes.legs.steps.transitDetails.transitLine.name",
  "routes.legs.steps.transitDetails.transitLine.nameShort",
  "routes.legs.steps.transitDetails.transitLine.color",
  "routes.legs.steps.transitDetails.transitLine.textColor",
  "routes.legs.steps.transitDetails.transitLine.vehicle.type",
  "routes.legs.steps.transitDetails.headsign",
  "routes.legs.steps.transitDetails.stopCount",
  "routes.legs.steps.transitDetails.stopDetails.departureTime",
  "routes.legs.steps.transitDetails.stopDetails.arrivalTime",
  "routes.legs.steps.transitDetails.stopDetails.departureStop.name",
  "routes.legs.steps.transitDetails.stopDetails.arrivalStop.name",
].join(",");

/**
 * Fetches a real public-transport itinerary between two points. Returns
 * null (never throws) on any failure, exactly like getWalkingRoute — a
 * missing transit route is not worth crashing the navigation screen over;
 * the caller falls back to an "Open in Google Maps" link.
 */
export async function getTransitRoute(
  origin: { lng: number; lat: number },
  destination: { lng: number; lat: number },
  options: { languageCode?: string } = {},
): Promise<TransitRoute | null> {
  const route = await computeRoutes({
    origin,
    destination,
    travelMode: "TRANSIT",
    fieldMask: FIELD_MASK,
    languageCode: options.languageCode,
  });

  const encoded = route?.polyline?.encodedPolyline;
  if (!route || !encoded) return null;

  const rawSteps = (route.legs?.flatMap((leg) => leg.steps ?? []) ?? []) as RawStep[];
  const steps: TransitRouteStep[] = rawSteps
    .filter((s) => {
      if (!s.startLocation?.latLng || !s.endLocation?.latLng) return false;
      // A TRANSIT step carries no instruction (it's composed from
      // transitDetails downstream), and a WALK step carries no
      // transitDetails — but a step with NEITHER has nothing to say, and
      // would render as a blank row with only a distance beside it.
      // walkingRoute.ts filters those out via its instruction predicate;
      // this is that guard, widened to let real transit legs through.
      return Boolean(s.navigationInstruction?.instructions || s.transitDetails);
    })
    .map((s) => {
      const td = s.transitDetails;
      return {
        instruction: s.navigationInstruction?.instructions ?? null,
        maneuver: s.navigationInstruction?.maneuver ?? "STRAIGHT",
        travelMode: s.travelMode === "TRANSIT" ? ("TRANSIT" as const) : ("WALK" as const),
        transitDetails: td
          ? {
              line: {
                name: td.transitLine?.name ?? null,
                shortName: td.transitLine?.nameShort ?? null,
                color: td.transitLine?.color ?? null,
                textColor: td.transitLine?.textColor ?? null,
                vehicleType: td.transitLine?.vehicle?.type ?? null,
              },
              headsign: td.headsign ?? null,
              stopCount: td.stopCount ?? null,
              departureStop: td.stopDetails?.departureStop?.name ?? null,
              arrivalStop: td.stopDetails?.arrivalStop?.name ?? null,
              departureTime: td.stopDetails?.departureTime ?? null,
              arrivalTime: td.stopDetails?.arrivalTime ?? null,
            }
          : null,
        distanceMeters: s.distanceMeters ?? 0,
        durationSeconds: parseSeconds(s.staticDuration),
        startLocation: { lng: s.startLocation!.latLng!.longitude!, lat: s.startLocation!.latLng!.latitude! },
        endLocation: { lng: s.endLocation!.latLng!.longitude!, lat: s.endLocation!.latLng!.latitude! },
      };
    });

  return {
    distanceMeters: route.distanceMeters ?? 0,
    durationSeconds: parseSeconds(route.duration),
    path: decodePolyline(encoded),
    steps,
  };
}

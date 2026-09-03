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

import { decodePolyline } from "./polyline";

export interface TransitLine {
  /** Full line name, e.g. "Tram 14". */
  name: string | null;
  /** Short form Google supplies for badges, e.g. "14". */
  shortName: string | null;
  /** Hex colour Google associates with this line/operator, e.g. "#E4572E" — null if Google didn't supply one. */
  color: string | null;
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

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not set. Check .env.local.");
  return key;
}

interface RawTransitLine {
  name?: string;
  nameShort?: string;
  color?: string;
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

interface RawStep {
  travelMode?: string;
  distanceMeters?: number;
  staticDuration?: string;
  navigationInstruction?: { maneuver?: string; instructions?: string };
  startLocation?: { latLng?: { latitude?: number; longitude?: number } };
  endLocation?: { latLng?: { latitude?: number; longitude?: number } };
  transitDetails?: RawTransitDetails;
}

function parseSeconds(duration: string | undefined): number {
  return duration ? parseInt(duration, 10) : 0;
}

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
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey(),
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: "TRANSIT",
        ...(options.languageCode ? { languageCode: options.languageCode } : {}),
      }),
    });
    if (!res.ok) return null;

    const body = (await res.json()) as {
      routes?: Array<{
        distanceMeters?: number;
        duration?: string;
        polyline?: { encodedPolyline?: string };
        legs?: Array<{ steps?: RawStep[] }>;
      }>;
    };
    const route = body.routes?.[0];
    const encoded = route?.polyline?.encodedPolyline;
    if (!route || !encoded) return null;

    const rawSteps = route.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
    const steps: TransitRouteStep[] = rawSteps
      .filter((s) => s.startLocation?.latLng && s.endLocation?.latLng)
      .map((s) => {
        const td = s.transitDetails;
        return {
          instruction: s.navigationInstruction?.instructions ?? null,
          maneuver: s.navigationInstruction?.maneuver ?? "STRAIGHT",
          travelMode: s.travelMode === "TRANSIT" ? "TRANSIT" : "WALK",
          transitDetails: td
            ? {
                line: {
                  name: td.transitLine?.name ?? null,
                  shortName: td.transitLine?.nameShort ?? null,
                  color: td.transitLine?.color ?? null,
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
  } catch {
    return null;
  }
}

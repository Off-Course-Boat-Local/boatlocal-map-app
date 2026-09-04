// Shared plumbing for Google's Routes API (`computeRoutes`) — the parts
// walkingRoute.ts and transitRoute.ts were holding byte-identical copies of.
//
// WHY THIS EXISTS (2026-09-04): those two modules deliberately keep separate
// field masks and separate response mappers, because a transit itinerary
// genuinely parses differently from a walking one and the two bill on
// different SKUs. That split is right. What was NOT right was duplicating
// the key lookup, the duration parser, and the whole fetch envelope in both
// — ~45 identical lines where adding a timeout, a retry, or a regionCode
// meant remembering there were two files. Those live here now; the mappers
// stay where they are.
//
// KEY STAYS SERVER-SIDE: `server-only` here as well as in both callers, so
// no client component can pull this in transitively.

import "server-only";

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not set. Check .env.local.");
  return key;
}

/** Google returns durations as a seconds string ("930s" or "930"); parseInt handles both. */
export function parseSeconds(duration: string | undefined): number {
  return duration ? parseInt(duration, 10) : 0;
}

export interface RawRouteStep {
  travelMode?: string;
  distanceMeters?: number;
  staticDuration?: string;
  navigationInstruction?: { maneuver?: string; instructions?: string };
  startLocation?: { latLng?: { latitude?: number; longitude?: number } };
  endLocation?: { latLng?: { latitude?: number; longitude?: number } };
  transitDetails?: unknown;
}

export interface RawRoute {
  distanceMeters?: number;
  duration?: string;
  polyline?: { encodedPolyline?: string };
  legs?: Array<{ steps?: RawRouteStep[] }>;
}

export interface ComputeRoutesInput {
  origin: { lng: number; lat: number };
  destination: { lng: number; lat: number };
  travelMode: "WALK" | "TRANSIT";
  fieldMask: string;
  /** BCP-47. Google localises its own instruction text when given this. */
  languageCode?: string;
}

/**
 * POSTs one computeRoutes request and returns the first route, or null.
 *
 * NEVER THROWS — a bad or missing route is not worth crashing a map (or a
 * navigation screen) over; callers fall back accordingly. But unlike the
 * silent `return null` this replaces, the REASON is logged server-side:
 * Google puts PERMISSION_DENIED (SKU not enabled), RESOURCE_EXHAUSTED
 * (quota/billing) and INVALID_ARGUMENT (bad field mask) in the response
 * body, and discarding that made the single most likely production failure
 * — transit billing not being enabled on the Maps Platform project —
 * indistinguishable from "there is genuinely no route here". Vercel
 * captures stderr, so this turns a silent 502 into a greppable one. Nothing
 * is added to the guest-facing response.
 */
export async function computeRoutes({
  origin,
  destination,
  travelMode,
  fieldMask,
  languageCode,
}: ComputeRoutesInput): Promise<RawRoute | null> {
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey(),
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: {
          location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
        },
        travelMode,
        ...(languageCode ? { languageCode } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[routes-api] ${travelMode} ${res.status}: ${body.slice(0, 300)}`);
      return null;
    }

    const parsed = (await res.json()) as { routes?: RawRoute[] };
    return parsed.routes?.[0] ?? null;
  } catch (error) {
    console.error(`[routes-api] ${travelMode} request failed:`, error);
    return null;
  }
}

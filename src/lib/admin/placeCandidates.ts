// Affiliate outreach — candidate discovery via Google Places Text Search
// (New), for the funnel-refill routine's /api/admin/outreach/candidates
// endpoint (docs/outreach-research.md). Deliberately separate from
// googlePlaces.ts: that module fetches ONE place in full (photos, hours,
// review snippets — expensive, ~$0.13/place) for an admin curating a
// single recommendation by hand; this fetches MANY places cheaply for a
// weekly bulk sweep and asks Text Search's own field mask for exactly the
// columns outreach_prospects can store (rating, review count, website,
// phone, business status) — no separate Details call per result, no
// photos. Reuses that module's PLACES_BASE/apiKey/AMSTERDAM_CENTER only by
// duplicating the two constants, not by importing: importing would pull in
// the photo-storage code path for no reason.

import "server-only";

const PLACES_BASE = "https://places.googleapis.com/v1";
const AMSTERDAM_CENTER = { lat: 52.3702, lng: 4.8952 };
const SEARCH_RADIUS_METERS = 12_000;

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not set. Check .env.local.");
  return key;
}

export interface PlaceCandidate {
  googlePlaceId: string;
  name: string;
  address: string;
  website: string | null;
  phone: string | null;
  rating: number | null;
  reviewCount: number | null;
  types: string[];
  primaryType: string | null;
  /** Google's own operating status — used to drop permanently/temporarily closed places before they ever reach the agent. */
  businessStatus: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | null;
}

interface SearchTextResponseBody {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    websiteUri?: string;
    nationalPhoneNumber?: string;
    rating?: number;
    userRatingCount?: number;
    types?: string[];
    primaryType?: string;
    businessStatus?: string;
  }>;
}

const FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber," +
  "places.rating,places.userRatingCount,places.types,places.primaryType,places.businessStatus";

/**
 * One Text Search (New) call for one query, biased to Amsterdam. Returns
 * up to 20 results (Google's own per-request cap) with everything the
 * qualification rules and the outreach_prospects row need — no per-result
 * Details call, unlike googlePlaces.ts's getPlaceDetails.
 */
export async function searchPlaceCandidates(query: string): Promise<PlaceCandidate[]> {
  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      locationBias: {
        circle: {
          center: { latitude: AMSTERDAM_CENTER.lat, longitude: AMSTERDAM_CENTER.lng },
          radius: SEARCH_RADIUS_METERS,
        },
      },
      maxResultCount: 20,
    }),
  });

  if (!res.ok) {
    throw new Error(`Places text search returned ${res.status} for query "${query}"`);
  }

  const body = (await res.json()) as SearchTextResponseBody;
  return (body.places ?? [])
    .filter((p): p is Required<Pick<typeof p, "id">> & typeof p => Boolean(p.id))
    .map((p) => ({
      googlePlaceId: p.id as string,
      name: p.displayName?.text?.trim() || "Unnamed place",
      address: p.formattedAddress?.trim() || "",
      website: p.websiteUri?.trim() || null,
      phone: p.nationalPhoneNumber?.trim() || null,
      rating: typeof p.rating === "number" ? p.rating : null,
      reviewCount: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
      types: p.types ?? [],
      primaryType: p.primaryType ?? null,
      businessStatus:
        p.businessStatus === "OPERATIONAL" ||
        p.businessStatus === "CLOSED_TEMPORARILY" ||
        p.businessStatus === "CLOSED_PERMANENTLY"
          ? p.businessStatus
          : null,
    }));
}

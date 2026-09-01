// Google Places API (New) — search + details + photos for the Admin
// "Add an admin recommendation" form's Google Maps enrichment.
//
// OVERRIDE OF THE HOUSE RULE: src/lib/studio/geocode.ts and
// adminRecommendationForm.ts both document a deliberate house rule against
// Google Places (cost, and Google's ToS restricting caching/display of
// Places content on a non-Google map — this app renders on MapLibre +
// OpenFreeMap tiles). This module is a knowing, explicit override of that
// rule for one specific flow (founder request, 2026-09-01): pulling a
// place's category/hours/photos from Google to speed up manually curating
// admin recommendations. The address-search-and-pin flow elsewhere in the
// app (AddressField.tsx / geocode.ts) is UNCHANGED and still uses Photon —
// this override is scoped to this one form's enrichment button, not a
// blanket switch of the whole app onto Google.
//
// Server-only: the API key never reaches the browser. Every call here is
// made from an Admin API route (session-gated the same way
// /api/admin/geocode is), never directly from a client component.

import "server-only";

const PLACES_BASE = "https://places.googleapis.com/v1";

/** Amsterdam — every search is biased here, per "always around or in Amsterdam". */
const AMSTERDAM_CENTER = { lat: 52.3702, lng: 4.8952 };
const SEARCH_RADIUS_METERS = 15_000;

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not set. Check .env.local.");
  return key;
}

/* ------------------------------------------------------------------ */
/*  Category guessing                                                  */
/* ------------------------------------------------------------------ */
//
// Places (New) returns an array of Google "type" strings per place (e.g.
// ["cafe", "bakery", "food", "point_of_interest"]) — richer than our own
// fixed, single-select CategoryId. This maps Google's types down to our
// category list, in priority order (first matching type wins), so the admin
// gets a pre-selected best guess but the existing <select> still has final
// say — this never stores more than one category, since the schema (and the
// existing form) only has room for one.

const GOOGLE_TYPE_TO_CATEGORY: Array<{ types: string[]; category: string }> = [
  { types: ["cafe", "coffee_shop"], category: "coffee" },
  { types: ["bakery", "breakfast_restaurant", "brunch_restaurant"], category: "breakfast" },
  { types: ["bar", "night_club", "pub", "wine_bar"], category: "drinks" },
  {
    types: ["restaurant", "meal_takeaway", "meal_delivery", "food"],
    category: "lunch",
  },
  {
    types: [
      "tourist_attraction",
      "museum",
      "art_gallery",
      "church",
      "place_of_worship",
      "park",
      "landmark",
      "monument",
    ],
    category: "see",
  },
  { types: ["store", "shopping_mall", "clothing_store", "gift_shop", "book_store"], category: "shop" },
];

/** Best-guess CategoryId from Google's `types`, or null if nothing matched. */
export function guessCategory(types: string[]): string | null {
  for (const rule of GOOGLE_TYPE_TO_CATEGORY) {
    if (rule.types.some((t) => types.includes(t))) return rule.category;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Text search                                                        */
/* ------------------------------------------------------------------ */

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  types: string[];
}

interface SearchTextResponseBody {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    types?: string[];
  }>;
}

/**
 * Text Search (New): https://developers.google.com/maps/documentation/places/web-service/text-search
 * Biased to Amsterdam via locationBias — a name like "Café de Jaren" almost
 * always resolves to the right one without needing the admin to also type
 * a city.
 */
export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.types",
    },
    body: JSON.stringify({
      textQuery: q,
      locationBias: {
        circle: {
          center: { latitude: AMSTERDAM_CENTER.lat, longitude: AMSTERDAM_CENTER.lng },
          radius: SEARCH_RADIUS_METERS,
        },
      },
      maxResultCount: 8,
    }),
  });

  if (!res.ok) {
    throw new Error(`Places text search returned ${res.status}`);
  }

  const body = (await res.json()) as SearchTextResponseBody;
  return (body.places ?? [])
    .filter((p): p is Required<Pick<typeof p, "id">> & typeof p => Boolean(p.id))
    .map((p) => ({
      placeId: p.id as string,
      name: p.displayName?.text?.trim() || "Unnamed place",
      address: p.formattedAddress?.trim() || "",
      types: p.types ?? [],
    }));
}

/* ------------------------------------------------------------------ */
/*  Place details + photos                                             */
/* ------------------------------------------------------------------ */

export interface PlaceDetails {
  name: string;
  address: string;
  area: string;
  lat: number;
  lng: number;
  hours: string;
  suggestedCategory: string | null;
  /** Data-URL strings, ready to feed straight into AdminBoatPhotosField. */
  photos: string[];
}

interface PlaceDetailsResponseBody {
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: Array<{ longText?: string; types?: string[] }>;
  location?: { latitude?: number; longitude?: number };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  types?: string[];
  photos?: Array<{ name?: string }>;
}

const MAX_PHOTOS = 8;
const PHOTO_MAX_WIDTH_PX = 1200;

/** Pulls the neighbourhood-ish component out of Places' addressComponents, same idea as Photon's district/suburb fallback in geocode.ts. */
function guessArea(components: PlaceDetailsResponseBody["addressComponents"]): string {
  const priority = ["sublocality_level_1", "sublocality", "neighborhood", "locality"];
  for (const type of priority) {
    const match = components?.find((c) => c.types?.includes(type));
    if (match?.longText) return match.longText;
  }
  return "";
}

/** Fetches one Places photo's bytes and returns it as a data URL. Never throws — a failed photo is just dropped, since 7 good photos beats a 500 for the whole form. */
async function fetchPhotoAsDataUrl(photoName: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${PLACES_BASE}/${photoName}/media?maxWidthPx=${PHOTO_MAX_WIDTH_PX}&key=${apiKey()}`,
    );
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Place Details (New) + up to MAX_PHOTOS photo downloads, run in parallel.
 * Everything this returns is shaped to drop straight into
 * AdminRecommendationForm's existing fields.
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const res = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask":
        "displayName,formattedAddress,addressComponents,location,regularOpeningHours,types,photos",
    },
  });

  if (!res.ok) {
    throw new Error(`Places details returned ${res.status}`);
  }

  const body = (await res.json()) as PlaceDetailsResponseBody;

  const photoNames = (body.photos ?? [])
    .map((p) => p.name)
    .filter((n): n is string => Boolean(n))
    .slice(0, MAX_PHOTOS);
  const photos = (await Promise.all(photoNames.map(fetchPhotoAsDataUrl))).filter(
    (p): p is string => p !== null,
  );

  return {
    name: body.displayName?.text?.trim() || "",
    address: body.formattedAddress?.trim() || "",
    area: guessArea(body.addressComponents),
    lat: body.location?.latitude ?? NaN,
    lng: body.location?.longitude ?? NaN,
    hours: (body.regularOpeningHours?.weekdayDescriptions ?? []).join("; "),
    suggestedCategory: guessCategory(body.types ?? []),
    photos,
  };
}

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

import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

const PLACES_BASE = "https://places.googleapis.com/v1";

/**
 * Where every photo this module fetches ends up — see
 * scripts/migrate-photos-to-storage.mjs for why: `recommendations.photos`
 * used to hold full base64 data URLs inline in the row, which meant every
 * guest visiting /list or /saved downloaded the ENTIRE photo set for every
 * recommendation as part of the page's own HTML on every navigation
 * (15–28 MB per load — founder report, 2026-09-02: "loading is very very
 * slow"). Photos now live here as ordinary Storage objects, and a
 * recommendation row holds a short public URL instead — a normal,
 * independently-cacheable image request rather than page payload.
 */
const PHOTO_BUCKET = "recommendation-photos";

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
// fixed category list. This maps Google's types down to every one of our
// categories that matches (a place tagged both "cafe" and "bakery" guesses
// both "coffee" and "breakfast"), in the same priority order the rules are
// listed below, so the admin/company gets a pre-selected best guess but the
// checkbox group still has final say.

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

/** Every matching CategoryId guessed from Google's `types`, in rule priority order. Empty if nothing matched. */
export function guessCategories(types: string[]): string[] {
  const matches: string[] = [];
  for (const rule of GOOGLE_TYPE_TO_CATEGORY) {
    if (rule.types.some((t) => types.includes(t))) matches.push(rule.category);
  }
  return matches;
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
  suggestedCategories: string[];
  /** Public Storage URLs (PHOTO_BUCKET), ready to feed straight into AdminBoatPhotosField — never data URLs, see PHOTO_BUCKET's own comment. */
  photos: string[];
  /**
   * Google's own rating (out of 5) and review count — "Atmosphere Data"
   * tier, a step up in cost from the plain lookup this module used before.
   * DELIBERATELY NEVER written to a `recommendations` row or shown to a
   * guest — see GuestPlaceRow.tsx / PlaceCard.tsx's own "no star rating,
   * no review count, anywhere" comments. This exists only as curation
   * context for whoever is deciding whether to add the place (see
   * VoiceAddPlaces.tsx), same spirit as reviewSnippets/vibeSummary below.
   */
  rating: number | null;
  reviewCount: number | null;
  /** Up to a handful of review excerpts, for summarizeVibe() to read — never shown verbatim to a guest. */
  reviewSnippets: string[];
}

interface PlaceDetailsResponseBody {
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: Array<{ longText?: string; types?: string[] }>;
  location?: { latitude?: number; longitude?: number };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  types?: string[];
  photos?: Array<{ name?: string }>;
  rating?: number;
  userRatingCount?: number;
  reviews?: Array<{ text?: { text?: string } }>;
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

/**
 * Fetches one Places photo's bytes, uploads it to PHOTO_BUCKET, and returns
 * its public URL. Never throws — a failed photo is just dropped, since 7
 * good photos beats a 500 for the whole form.
 *
 * Keyed by a fresh random id, not a recommendation id: enrichment runs
 * BEFORE a recommendation row exists (the founder is still previewing the
 * form, or a "Talk to add places" draft hasn't been confirmed yet), so
 * there's nothing to key the path on yet. An abandoned enrichment leaves a
 * few orphaned small image objects in Storage — a trivial, low-volume cost
 * next to the problem this replaces.
 */
async function fetchAndStorePlacePhoto(photoName: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${PLACES_BASE}/${photoName}/media?maxWidthPx=${PHOTO_MAX_WIDTH_PX}&key=${apiKey()}`,
    );
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());

    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `google-places/${randomUUID()}.${ext}`;
    const { error } = await createAdminClient()
      .storage.from(PHOTO_BUCKET)
      .upload(path, buffer, { contentType, upsert: false });
    if (error) return null;

    const {
      data: { publicUrl },
    } = createAdminClient().storage.from(PHOTO_BUCKET).getPublicUrl(path);
    return publicUrl;
  } catch {
    return null;
  }
}

/**
 * Place Details (New) + up to MAX_PHOTOS photo downloads, run in parallel.
 * Everything this returns is shaped to drop straight into
 * AdminRecommendationForm's existing fields.
 */
const MAX_REVIEW_SNIPPETS = 5;
const REVIEW_SNIPPET_MAX_CHARS = 500;

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const res = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask":
        "displayName,formattedAddress,addressComponents,location,regularOpeningHours,types,photos," +
        "rating,userRatingCount,reviews",
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
  const photos = (await Promise.all(photoNames.map(fetchAndStorePlacePhoto))).filter(
    (p): p is string => p !== null,
  );

  const reviewSnippets = (body.reviews ?? [])
    .map((r) => r.text?.text?.trim())
    .filter((t): t is string => Boolean(t))
    .slice(0, MAX_REVIEW_SNIPPETS)
    .map((t) => (t.length > REVIEW_SNIPPET_MAX_CHARS ? `${t.slice(0, REVIEW_SNIPPET_MAX_CHARS)}…` : t));

  return {
    name: body.displayName?.text?.trim() || "",
    address: body.formattedAddress?.trim() || "",
    area: guessArea(body.addressComponents),
    lat: body.location?.latitude ?? NaN,
    lng: body.location?.longitude ?? NaN,
    hours: (body.regularOpeningHours?.weekdayDescriptions ?? []).join("; "),
    suggestedCategories: guessCategories(body.types ?? []),
    photos,
    rating: body.rating ?? null,
    reviewCount: body.userRatingCount ?? null,
    reviewSnippets,
  };
}

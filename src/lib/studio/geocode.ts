// Address lookup for the Studio "Add / edit place" form.
//
// WHY THIS EXISTS: the form used to ask for longitude and latitude as two
// number fields, with helper copy telling the user to go find them in
// another map app. That is a reasonable thing to ask of a developer and an
// unreasonable thing to ask of a guide ("not everybody will know longitude
// and latitude, and they'll be typing something else"). So the human types
// a place name or address, picks from a suggestion list, and the pin lands
// on the map — lng/lat are still what gets STORED (nothing in the schema,
// the guest map, or src/lib/distance.ts changes), they are just no longer
// something a person has to know.
//
// PROVIDER CHOICE — deliberately not Google Places. There is a standing
// house rule against it (see recommendationForm.ts's own note), and beyond
// the rule, Google's terms restrict caching the coordinates it returns and
// displaying them on a non-Google map, which is exactly what this app does
// (MapLibre + OpenFreeMap tiles). Photon is the default here instead:
// OSM-derived like the tiles already in use, built for type-ahead, needs no
// API key, and returns POIs by name — which matters because a guide types
// "Bakers & Roasters", not "Eerste Jacob van Campenstraat 54".
//
// Swapping providers is one env var plus one function: set
// STUDIO_GEOCODER_URL to a Photon-compatible endpoint (a self-hosted Photon,
// or a commercial OSM geocoder) when free-tier rate limits stop being
// acceptable. The shape below is what the rest of the app depends on, not
// the provider.
//
// No Next.js imports here on purpose — this stays unit-testable and is
// imported by both the API route and (types only) the client component.

/** One geocoder suggestion, already flattened into what the form needs. */
export interface GeocodeResult {
  /** Stable-enough key for React lists; not persisted. */
  id: string;
  /** Bold first line — the POI or street name, e.g. "Bakers & Roasters". */
  label: string;
  /** Grey second line — the rest of the address, e.g. "Eerste Jacob van Campenstraat 54, Amsterdam". */
  context: string;
  /** What goes in the form's `address` field when this result is picked. */
  address: string;
  /** Best guess at the neighbourhood/district, for the `area` field. May be "". */
  area: string;
  lng: number;
  lat: number;
}

const DEFAULT_GEOCODER_URL = "https://photon.komoot.io/api";

/** Photon's GeoJSON feature shape — only the fields actually read below. */
interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    suburb?: string;
    locality?: string;
    county?: string;
    state?: string;
    country?: string;
    osm_id?: number | string;
    osm_type?: string;
  };
}

/** Joins address parts, dropping blanks so we never emit ", , Amsterdam". */
function join(parts: (string | undefined)[], sep = ", "): string {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(sep);
}

/**
 * Flattens one Photon feature. Exported for unit tests — the mapping from
 * "OSM tags" to "what a guide expects to see in the Address box" is the
 * fiddly part worth pinning down, not the fetch around it.
 */
export function toGeocodeResult(feature: PhotonFeature, index: number): GeocodeResult | null {
  const coords = feature.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const p = feature.properties ?? {};

  // Photon puts the house number and street in separate fields, and only
  // sets `name` for named features (a POI, a park). For a plain street
  // address `name` is absent, so the street line has to stand in as the
  // headline or the suggestion renders with an empty first line.
  const streetLine = join([join([p.street, p.housenumber], " ")], " ");
  const label = p.name?.trim() || streetLine || p.city?.trim() || "Unnamed place";

  // The address we store: prefer the real street line; fall back to the
  // name so the field is never blank (it's `required` on the form).
  const address = streetLine || p.name?.trim() || "";

  const area = (p.district || p.suburb || p.locality || p.city || "").trim();
  const context = join([
    streetLine && streetLine !== label ? streetLine : undefined,
    p.postcode,
    p.city,
    p.country,
  ]);

  return {
    id: `${p.osm_type ?? "x"}${p.osm_id ?? index}-${index}`,
    label,
    context,
    address,
    area,
    lng,
    lat,
  };
}

export interface GeocodeSearchOptions {
  /** Bias results toward here — the map's current centre. Strongly improves relevance. */
  bias?: { lng: number; lat: number };
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Queries the configured geocoder. Server-side only in practice (called
 * from the API route) so the outbound request carries our own User-Agent
 * and the browser never talks to the geocoder directly — that keeps the
 * guide's keystrokes from being sent to a third party with the Studio
 * page's Referer attached, and leaves one place to add caching or a paid
 * key later.
 */
export async function geocodeSearch(
  query: string,
  options: GeocodeSearchOptions = {},
): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const base = process.env.STUDIO_GEOCODER_URL || DEFAULT_GEOCODER_URL;
  const url = new URL(base);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(options.limit ?? 6));
  url.searchParams.set("lang", "en");
  if (options.bias) {
    url.searchParams.set("lat", String(options.bias.lat));
    url.searchParams.set("lon", String(options.bias.lng));
  }

  const res = await fetch(url, {
    signal: options.signal,
    headers: {
      // Nominatim-family services require a real identifying UA and will
      // hard-block a generic one.
      "User-Agent": "MapApp-Studio/1.0 (+https://map.boatlocal.nl)",
      Accept: "application/json",
    },
    // Same query from the same guide twice in a row is common (they retype
    // a character); let the platform cache briefly rather than re-hitting
    // a rate-limited free endpoint.
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Geocoder returned ${res.status}`);
  }

  const body = (await res.json()) as { features?: PhotonFeature[] };
  const features = Array.isArray(body.features) ? body.features : [];

  return features
    .map((f, i) => toGeocodeResult(f, i))
    .filter((r): r is GeocodeResult => r !== null);
}

/* ------------------------------------------------------------------ */
/*  Google Maps URL parsing                                            */
/* ------------------------------------------------------------------ */
//
// A founder-requested shortcut: a lot of the time the "address" someone has
// in hand is really a Google Maps link they just copied out of their own
// browser — a share link, or the address bar after they dragged the map
// around. Those links usually already carry the exact coordinates as plain
// text in the URL, so there is no reason to send that string to the
// geocoder as a search query (it would either fail outright or match
// nothing sensible). This is PURE URL PARSING: no request to Google, no API
// key, no dependency on their geocoding service at all — it only decodes
// digits a human already copied.

function toUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    // Pasted address-bar text sometimes arrives without a scheme.
  }
  try {
    return new URL(`https://${raw}`);
  } catch {
    return null;
  }
}

function isValidCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Pulls a {lat, lng} out of a pasted Google Maps URL, or returns null for
 * anything else — including a Google Maps URL that doesn't happen to carry
 * coordinates in its text (a plain place-name search link, or a shortened
 * `maps.app.goo.gl` link whose target lives server-side, not in the text
 * itself). The caller falls back to treating the input as a normal search
 * query in that case.
 *
 * Handles, checked in priority order (most to least precise — a
 * `/maps/place/...` URL commonly carries both an `@lat,lng` for the map's
 * *viewport* centre and a `!3d..!4d..` for the actual pinned place, and
 * those two are not always the same point):
 *  - `!3d{lat}!4d{lng}` — e.g. `.../maps/place/Foo/@52.37,4.89,17z/data=
 *    !4m5!3m4!1s0x0:0x0!8m2!3d52.375!4d4.9003`
 *  - `@{lat},{lng}` — e.g. `https://www.google.com/maps/@52.3702,4.8952,17z`
 *  - `?q={lat},{lng}` — the older link form, e.g.
 *    `https://maps.google.com/?q=52.3702,4.8952`
 */
export function parseGoogleMapsUrl(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const url = toUrl(trimmed);
  if (!url) return null;

  const host = url.hostname.toLowerCase();
  const isGoogleHost = host === "google.com" || host.endsWith(".google.com");
  const isMapsHost = host === "maps.google.com";
  const isGoogleMapsPath = isGoogleHost && url.pathname.startsWith("/maps");
  if (!isMapsHost && !isGoogleMapsPath) return null;

  const href = url.href;

  const dPair = href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dPair) {
    const lat = Number(dPair[1]);
    const lng = Number(dPair[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  const atPair = href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atPair) {
    const lat = Number(atPair[1]);
    const lng = Number(atPair[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  const q = url.searchParams.get("q");
  if (q) {
    const qPair = q.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
    if (qPair) {
      const lat = Number(qPair[1]);
      const lng = Number(qPair[2]);
      if (isValidCoord(lat, lng)) return { lat, lng };
    }
  }

  return null;
}

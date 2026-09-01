// Fake data for the map spike — one guide, 14 places, 6 boat tours.
//
// Coordinates are real Amsterdam locations so the custom map style can be
// judged against actual geography. Notes and hours are written the way a
// real guide would write them: hours are free text (guide-entered).
// googleRating/googleReviewCount are null on every fixture place here —
// none of these were added through Google enrichment, so there is nothing
// to show alongside the guide's own note (see Place's own doc comment).
//
// Photos are placeholder URLs standing in for guide uploads.

import type { BoatTour, CategoryId, Guide, Place } from "./types";

const photo = (seed: string, n = 3) =>
  Array.from({ length: n }, (_, i) => `https://picsum.photos/seed/${seed}${i}/800/600`);

export const GUIDE: Guide = {
  name: "Jan",
  slug: "jan",
  welcome:
    "Welcome to my favourite city! I've collected the best spots just for you.",
  avatarInitial: "J",
};

/** Map should open here — Dam Square, the middle of the canal ring. */
export const AMSTERDAM_CENTER = { lng: 4.8936, lat: 52.3731, zoom: 13.4 };

/** Simulated guest position for the spike when geolocation is denied/unavailable. */
export const FALLBACK_GUEST_POSITION = { lng: 4.8936, lat: 52.3731 };

export const PLACES: Place[] = [
  {
    id: "bakers-roasters",
    name: "Bakers & Roasters",
    categories: ["breakfast"],
    area: "De Pijp",
    address: "Eerste Jacob van Campenstraat 54",
    lng: 4.8917,
    lat: 52.3556,
    note: "Best pancakes in the city. Go before 9 or you'll queue for an hour.",
    hours: "Daily 08:30–16:00",
    photos: photo("bakers"),
    googleRating: null,
    googleReviewCount: null,
  },
  {
    id: "mook-pancakes",
    name: "Mook Pancakes",
    categories: ["breakfast"],
    area: "Centrum",
    address: "Vondelstraat 24",
    lng: 4.8807,
    lat: 52.3639,
    note: "Dutch pancakes done properly. The apple one is the move.",
    hours: "Daily 09:00–17:00",
    photos: photo("mook"),
    googleRating: null,
    googleReviewCount: null,
  },
  {
    id: "cafe-de-jaren",
    name: "Café de Jaren",
    categories: ["lunch"],
    area: "Centrum",
    address: "Nieuwe Doelenstraat 20",
    lng: 4.8956,
    lat: 52.3676,
    note: "Sit on the terrace over the Amstel. Worth it for the view alone.",
    hours: "Daily 10:00–01:00",
    photos: photo("jaren"),
    googleRating: null,
    googleReviewCount: null,
  },
  {
    id: "pendergast",
    name: "Pendergast",
    categories: ["lunch"],
    area: "Jordaan",
    address: "Tweede Egelantiersdwarsstraat 6",
    lng: 4.8815,
    lat: 52.3745,
    note: "Great sandwiches, no fuss. Where I actually eat on my day off.",
    hours: "Tue–Sun 11:00–18:00, closed Mondays",
    photos: photo("pender"),
    googleRating: null,
    googleReviewCount: null,
  },
  {
    id: "foodhallen",
    name: "Foodhallen",
    categories: ["lunch"],
    area: "Oud-West",
    address: "Bellamyplein 51",
    lng: 4.869,
    lat: 52.3661,
    note: "Old tram depot, twenty food stalls. Good when nobody can agree.",
    hours: "Sun–Thu 11:00–23:30, Fri–Sat till 01:00",
    photos: photo("foodhal"),
    googleRating: null,
    googleReviewCount: null,
  },
  {
    id: "lot-sixty-one",
    name: "Lot Sixty One",
    categories: ["coffee"],
    area: "Oud-West",
    address: "Kinkerstraat 112",
    lng: 4.8703,
    lat: 52.3648,
    note: "They roast their own. Small place, take it away and walk.",
    hours: "Mon–Fri 08:00–17:00, weekends from 09:00",
    photos: photo("lot61"),
    googleRating: null,
    googleReviewCount: null,
  },
  {
    id: "screaming-beans",
    name: "Screaming Beans",
    categories: ["coffee"],
    area: "Nine Streets",
    address: "Hartenstraat 12",
    lng: 4.8853,
    lat: 52.3719,
    note: "Tiny, always busy, best flat white in the Nine Streets.",
    hours: "Daily 08:00–18:00",
    photos: photo("beans"),
    googleRating: null,
    googleReviewCount: null,
  },
  {
    id: "brouwerij-ij",
    name: "Brouwerij 't IJ",
    categories: ["drinks"],
    area: "Oost",
    address: "Funenkade 7",
    lng: 4.9265,
    lat: 52.3667,
    note: "Brewery under a windmill. Sit outside, order the Zatte.",
    hours: "Daily 14:00–20:00",
    photos: photo("brouwerij"),
    googleRating: null,
    googleReviewCount: null,
  },
  {
    id: "cafe-papeneiland",
    name: "Café Papeneiland",
    categories: ["drinks"],
    area: "Jordaan",
    address: "Prinsengracht 2",
    lng: 4.8846,
    lat: 52.3799,
    note: "A proper brown café from 1642. Order a jenever, don't rush it.",
    hours: "Daily 10:00–01:00",
    photos: photo("papen"),
    googleRating: null,
    googleReviewCount: null,
  },
  {
    id: "rijksmuseum",
    name: "Rijksmuseum",
    categories: ["see"],
    area: "Museumkwartier",
    address: "Museumstraat 1",
    lng: 4.8852,
    lat: 52.36,
    note: "Book online first. Go straight to the Night Watch, then wander back.",
    hours: "Daily 09:00–17:00",
    photos: photo("rijks"),
    googleRating: null,
    googleReviewCount: null,
  },
  {
    id: "anne-frank",
    name: "Anne Frank House",
    categories: ["see"],
    area: "Jordaan",
    address: "Westermarkt 20",
    lng: 4.884,
    lat: 52.3752,
    note: "Tickets sell out weeks ahead — book before you land, not here.",
    hours: "Daily 09:00–22:00",
    photos: photo("anne"),
    googleRating: null,
    googleReviewCount: null,
  },
  {
    id: "ndsm-werf",
    name: "NDSM Werf",
    categories: ["photo"],
    area: "Noord",
    address: "NDSM-plein 1",
    lng: 4.8927,
    lat: 52.4013,
    note: "Free ferry from Centraal. Street art everywhere, best light at sunset.",
    hours: "Always open",
    photos: photo("ndsm"),
    googleRating: null,
    googleReviewCount: null,
  },
  {
    id: "nine-streets",
    name: "De 9 Straatjes",
    categories: ["shop"],
    area: "Centrum",
    address: "Reestraat / Hartenstraat",
    lng: 4.8846,
    lat: 52.3712,
    note: "Nine little streets of small shops. Just walk them, don't plan it.",
    hours: "Most shops 10:00–18:00",
    photos: photo("negen"),
    googleRating: null,
    googleReviewCount: null,
  },
  {
    id: "waterlooplein",
    name: "Waterlooplein Market",
    categories: ["shop"],
    area: "Centrum",
    address: "Waterlooplein",
    lng: 4.9028,
    lat: 52.3676,
    note: "Flea market. Come early for the good stuff, haggle a little.",
    hours: "Mon–Sat 09:00–17:00, closed Sunday",
    photos: photo("waterloo"),
    googleRating: null,
    googleReviewCount: null,
  },
];

export const BOAT_TOURS: BoatTour[] = [
  {
    id: "sunset-canal",
    name: "Sunset Canal Cruise",
    area: "Central Station",
    lng: 4.9003,
    lat: 52.3791,
    meta: "90 min · €28 pp · drinks incl.",
    durationLabel: null,
    priceLabel: null,
    note: "My absolute favourite — book for golden hour.",
    bookingUrl: "https://boatlocal.nl/tours/sunset-canal-cruise",
    photos: photo("sunset"),
    position: 1,
  },
  {
    id: "morning-gracht",
    name: "Morning Gracht Tour",
    area: "Anne Frank area",
    lng: 4.8837,
    lat: 52.3766,
    meta: "60 min · €22 pp · quiet canals",
    durationLabel: null,
    priceLabel: null,
    note: "Before the crowds. The canals are glass at 9am.",
    bookingUrl: "https://boatlocal.nl/tours/morning-gracht",
    photos: photo("morning"),
    position: 2,
  },
  {
    id: "private-charter",
    name: "Private Charter",
    area: "Prinsengracht",
    lng: 4.8829,
    lat: 52.3695,
    meta: "2 hrs · from €180 · up to 8 guests",
    durationLabel: null,
    priceLabel: null,
    note: "Worth splitting with a group. Bring your own snacks.",
    bookingUrl: "https://boatlocal.nl/tours/private-charter",
    photos: photo("charter"),
    position: 3,
  },
  {
    id: "pizza-boat",
    name: "Pizza Boat",
    area: "Westerdok",
    lng: 4.8912,
    lat: 52.3856,
    meta: "2 hrs · €45 pp · dinner cruise",
    durationLabel: null,
    priceLabel: null,
    note: "Sounds like a gimmick. Is not a gimmick.",
    bookingUrl: "https://boatlocal.nl/tours/pizza-boat",
    photos: photo("pizza"),
    position: 4,
  },
  {
    id: "self-drive",
    name: "Self-Drive Boat Rental",
    area: "Prinsengracht",
    lng: 4.8867,
    lat: 52.3648,
    meta: "From €90 / 2 hrs · no licence needed",
    durationLabel: null,
    priceLabel: null,
    note: "Easier than it looks. Stay right, mind the tour boats.",
    bookingUrl: "https://boatlocal.nl/tours/self-drive",
    photos: photo("selfdrive"),
    position: 5,
  },
  {
    id: "evening-lights",
    name: "Evening Lights Cruise",
    area: "Centraal",
    lng: 4.8978,
    lat: 52.3776,
    meta: "75 min · €26 pp · covered boat",
    durationLabel: null,
    priceLabel: null,
    note: "The bridges are lit up. Good one for a rainy night.",
    bookingUrl: "https://boatlocal.nl/tours/evening-lights",
    photos: photo("lights"),
    position: 6,
  },
];

/** Everything that can appear as a pin, normalised. */
export interface MapPin {
  id: string;
  name: string;
  /** categories[0] is primary (pin colour/icon) — array order is priority order. */
  categories: import("./types").CategoryId[];
  area: string;
  lng: number;
  lat: number;
  note: string;
  /** "90 min · €28 pp" for boats, opening hours for places — the combined
   * legacy display string, kept as the fallback when a boat has no
   * structured durationLabel/priceLabel (an admin-curated tour with no
   * BoatLocal sync data). */
  meta: string;
  /** Boats only, and only when synced from BoatLocal: "1 hour & 30 mins" alone, for the small clock-iconed metadata row. Null for places and for admin-curated tours — render `meta` instead in that case. */
  durationLabel?: string | null;
  /** Boats only, and only when synced from BoatLocal: "from €15.95 pp" alone, for the bold footer price line. Null for places and for admin-curated tours — `meta` already carries the combined string in that case, so no separate bold price line renders. */
  priceLabel?: string | null;
  photos: string[];
  isBoat: boolean;
  bookingUrl?: string;
  /** See Place's own doc comment — null for a boat (no Google rating concept here) and for anything typed in by hand. */
  googleRating: number | null;
  googleReviewCount: number | null;
}

export const ALL_PINS: MapPin[] = [
  ...BOAT_TOURS.map((b) => ({
    id: b.id,
    name: b.name,
    categories: ["boats"] as CategoryId[],
    area: b.area,
    lng: b.lng,
    lat: b.lat,
    note: b.note,
    meta: b.meta,
    photos: b.photos,
    isBoat: true,
    bookingUrl: b.bookingUrl,
    googleRating: null,
    googleReviewCount: null,
  })),
  ...PLACES.map((p) => ({
    id: p.id,
    name: p.name,
    categories: p.categories,
    area: p.area,
    lng: p.lng,
    lat: p.lat,
    note: p.note,
    meta: p.hours,
    photos: p.photos,
    isBoat: false,
    googleRating: p.googleRating,
    googleReviewCount: p.googleReviewCount,
  })),
];

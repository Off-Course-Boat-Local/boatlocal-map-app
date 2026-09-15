// Google Maps hand-off.
//
// The dotted line and the padded distance answer "which way, roughly how far".
// When a guest wants actual turn-by-turn — which bridge, which alley — we hand
// off to Google Maps rather than paying for a routing API.
//
// This uses the documented, key-free Maps URLs scheme:
// https://developers.google.com/maps/documentation/urls/get-started#directions-action
//
// No API key. No SDK. Just a URL that works on iOS, Android and desktop web,
// and that opens the native app when one is installed.

const MAPS_DIR_BASE = "https://www.google.com/maps/dir/";

export interface GoogleMapsDirectionsInput {
  destLat: number;
  destLng: number;
  /** Only used for labelling — see the note below on why it is not the destination. */
  destName?: string;
}

/** @deprecated Kept as an alias while `googleMapsWalkingUrl` still carries the older name. Prefer GoogleMapsDirectionsInput. */
export type GoogleMapsWalkingUrlInput = GoogleMapsDirectionsInput;

/**
 * Builds a directions deep link to a destination, for one travel mode.
 *
 * Two deliberate decisions, shared by every mode:
 *
 * 1. **No `origin`.** Omitting it makes Google use the device's own live
 *    location. That is both more accurate than anything we could pass and
 *    means we never put the guest's coordinates in a URL.
 *
 * 2. **Coordinates, not the place name, as `destination`.** A name has to be
 *    geocoded by Google and can resolve to the wrong branch, a closed listing,
 *    or a similarly named spot in another city. The guide pinned an exact
 *    point; we send that exact point. The name is used for the button label
 *    instead.
 *
 * Everything is encoded via URLSearchParams, so names, commas and diacritics
 * are safe.
 */
function googleMapsDirectionsUrl(
  { destLat, destLng }: GoogleMapsDirectionsInput,
  travelmode: "walking" | "bicycling" | "transit",
): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destLat},${destLng}`,
    travelmode,
  });

  return `${MAPS_DIR_BASE}?${params.toString()}`;
}

/** Walking directions hand-off. See googleMapsDirectionsUrl for the shared decisions. */
export function googleMapsWalkingUrl(input: GoogleMapsDirectionsInput): string {
  return googleMapsDirectionsUrl(input, "walking");
}

/**
 * Cycling hand-off — same escape-hatch role as googleMapsTransitUrl below,
 * for in-app biking navigation (GuestNavigationScreen.tsx).
 */
export function googleMapsBikingUrl(input: GoogleMapsDirectionsInput): string {
  return googleMapsDirectionsUrl(input, "bicycling");
}

/**
 * Public-transport hand-off.
 *
 * Used as the escape hatch from in-app transit navigation
 * (GuestNavigationScreen.tsx): when Google can't route a guest by transit,
 * or they'd simply rather use the real Maps app with live departures, this
 * hands them off IN THE MODE THEY ASKED FOR rather than dropping them into
 * walking directions they didn't want.
 */
export function googleMapsTransitUrl(input: GoogleMapsDirectionsInput): string {
  return googleMapsDirectionsUrl(input, "transit");
}

/**
 * The label for the hand-off button.
 *
 * Kept short — the button sits in a card, and the destination name is already
 * the card's title, so repeating it is noise. Pass `long: true` where the
 * button appears without that context.
 */
export function directionsButtonLabel(
  destName?: string,
  options?: { long?: boolean },
): string {
  if (options?.long && destName) return `Directions to ${destName}`;
  return "Get directions";
}

/**
 * Accessible label. Screen-reader users get no visual card context and no
 * "opens in a new tab" affordance, so both are spelled out here.
 *
 * `mode` defaults to walking to keep existing callers unchanged — but it is
 * a parameter rather than hardcoded because a transit hand-off announcing
 * "walking directions" would be actively wrong for the one group of users
 * who can't see which button they pressed.
 */
export function directionsAriaLabel(
  destName?: string,
  mode: "walking" | "transit" = "walking",
): string {
  const where = destName ? ` to ${destName}` : "";
  const kind = mode === "transit" ? "public transport" : "walking";
  return `Get ${kind} directions${where} in Google Maps (opens in a new tab)`;
}

/** Props every "Get directions" anchor should spread, so nobody forgets rel. */
export const DIRECTIONS_LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

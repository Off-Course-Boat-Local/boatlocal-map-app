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

export interface GoogleMapsWalkingUrlInput {
  destLat: number;
  destLng: number;
  /** Only used for labelling — see the note below on why it is not the destination. */
  destName?: string;
}

/**
 * Builds a walking-directions deep link to a destination.
 *
 * Two deliberate decisions:
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
export function googleMapsWalkingUrl({
  destLat,
  destLng,
}: GoogleMapsWalkingUrlInput): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destLat},${destLng}`,
    travelmode: "walking",
  });

  return `${MAPS_DIR_BASE}?${params.toString()}`;
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
 */
export function directionsAriaLabel(destName?: string): string {
  const where = destName ? ` to ${destName}` : "";
  return `Get walking directions${where} in Google Maps (opens in a new tab)`;
}

/** Props every "Get directions" anchor should spread, so nobody forgets rel. */
export const DIRECTIONS_LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

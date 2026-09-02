// Arrival-triggered review prompt — dedup only, client-side, no login.
//
// GuestMapScreen shows a small "leave a review" banner once a guest who
// tapped "Walking directions" for a place gets within arrival range of it
// (see ARRIVAL_THRESHOLD_METERS there). This module just remembers which
// places have already prompted, so lingering near a pin (GPS jitter,
// standing around) doesn't re-show the banner every few seconds.
//
// sessionStorage, not localStorage: unlike saved places (permanent, this
// device, forever), "already asked about this arrival" should reset on a
// guest's NEXT visit — arriving at the same café again next week is a
// perfectly good reason to ask again. Same SSR-safe no-op-without-window
// posture as savedPlaces.ts.

const STORAGE_KEY_PREFIX = "boatlocal:review-prompt-shown:";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function hasShownArrivalPrompt(placeId: string): boolean {
  if (!isBrowser()) return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY_PREFIX + placeId) === "1";
  } catch {
    return false;
  }
}

export function markArrivalPromptShown(placeId: string): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY_PREFIX + placeId, "1");
  } catch {
    // Storage can throw (private browsing, quota) — worst case the banner
    // can show again, which is harmless.
  }
}

/* ------------------------------------------------------------------ */
/*  "You've looked at a few places" prompt                             */
/* ------------------------------------------------------------------ */
//
// A second, separate trigger from the arrival one above: once a guest has
// opened PLACES_VIEWED_BEFORE_PROMPT distinct recommendations, they've had
// enough of the guide's work to have an opinion about it — that's the
// moment to ask (founder, 2026-09-02: "when 4 locations have been viewed,
// prompt the same 5 star review drawer").
//
// Distinct ids, not a counter: re-opening the same café four times is one
// place looked at, not four, and a plain counter would ask a guest who is
// just tapping around a single pin.
//
// sessionStorage for the same reason as above — this is about "during this
// visit", and a guest browsing again next week is a fine person to re-ask.

/** How many distinct places a guest opens before the review drawer appears. */
export const PLACES_VIEWED_BEFORE_PROMPT = 4;

const VIEWED_PLACES_KEY = "boatlocal:viewed-places";
const BROWSE_PROMPT_KEY = "boatlocal:browse-prompt-shown";

function readViewedPlaces(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.sessionStorage.getItem(VIEWED_PLACES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Records that a place's detail was opened. Returns the new distinct-viewed count. */
export function markPlaceViewed(placeId: string): number {
  if (!isBrowser()) return 0;
  try {
    const viewed = readViewedPlaces();
    if (viewed.includes(placeId)) return viewed.length;
    const next = [...viewed, placeId];
    window.sessionStorage.setItem(VIEWED_PLACES_KEY, JSON.stringify(next));
    return next.length;
  } catch {
    return 0;
  }
}

export function viewedPlaceCount(): number {
  return readViewedPlaces().length;
}

/** True once the browse-triggered drawer has been shown (or dismissed) this visit. */
export function hasShownBrowsePrompt(): boolean {
  if (!isBrowser()) return false;
  try {
    return window.sessionStorage.getItem(BROWSE_PROMPT_KEY) === "1";
  } catch {
    return false;
  }
}

export function markBrowsePromptShown(): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(BROWSE_PROMPT_KEY, "1");
  } catch {
    // See markArrivalPromptShown — a re-show is harmless.
  }
}

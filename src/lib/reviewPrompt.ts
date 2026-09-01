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

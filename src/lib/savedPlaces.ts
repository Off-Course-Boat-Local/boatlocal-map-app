// Saved places — persisted client-side, no login.
//
// There is no guest account anywhere in this app (PRD: no login for the
// guest side at all), so "Saved" cannot live behind a user row. It lives in
// this browser, on this device, under one clearly-named localStorage key —
// just a list of place/boat-tour ids, the same ids that already key into
// MapPin (see src/lib/data.ts) / the guest_map_pins feed
// (src/lib/data/source.ts's getMapPins). Nothing here duplicates place data;
// a screen that wants to *render* a saved place still looks it up in the
// pins it already fetched.
//
// Real subdomains (one per tenant) will make this naturally per-tenant once
// they exist, because localStorage is scoped per browser *origin*. Until
// then every `?company=` preview shares one origin (localhost) and therefore
// one saved list — a saved id that doesn't exist in the previewed tenant's
// pins just quietly doesn't render anywhere, which is harmless for a dev
// preview and never happens in production once each tenant is its own host.
//
// SSR-safe: every read/write no-ops to an empty list on the server (no
// `window`), so this can be imported from anywhere without a guard at each
// call site.

/** Bump the suffix if the stored shape ever changes incompatibly. */
export const SAVED_PLACES_STORAGE_KEY = "boatlocal:saved-place-ids:v1";

/**
 * Fired on `window` (via `dispatchEvent`) whenever this tab's own write
 * changes the saved list. The browser's native `storage` event only fires in
 * *other* tabs, never the one that made the change — this event fills that
 * gap so a hook in the same tab (e.g. the bottom nav badge) can react to a
 * toggle made by a sibling component (e.g. a card's heart) without both
 * needing to share React state.
 */
export const SAVED_PLACES_CHANGE_EVENT = "boatlocal:saved-places-changed";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Stable "nothing saved" reference — see the cache note on readSnapshot(). */
const EMPTY_IDS: string[] = [];

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Dedupe while filtering to strings, preserving first-seen order.
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const value of parsed) {
      if (typeof value === "string" && !seen.has(value)) {
        seen.add(value);
        ids.push(value);
      }
    }
    return ids;
  } catch {
    // Corrupt or hand-edited localStorage should degrade to "nothing saved",
    // never throw and break the Saved screen.
    return [];
  }
}

// Cache of the last-parsed snapshot, keyed by the raw string it was parsed
// from. This exists for exactly one reason: useSavedPlaces (src/hooks/useSavedPlaces.ts)
// wires getSavedPlaceIds() straight into useSyncExternalStore as the
// snapshot getter, and that API requires the same *reference* back when
// nothing changed — returning a freshly-parsed array on every call (even
// with identical contents) makes React think the store changed on every
// render and throws "The result of getSnapshot should be cached". Every
// write path in this module (persist()) updates the cache directly, so it
// only ever falls back to re-parsing here when something *external* wrote
// to localStorage (another tab).
let cachedRaw: string | null | undefined;
let cachedIds: string[] = EMPTY_IDS;

function readSnapshot(): string[] {
  if (!isBrowser()) return EMPTY_IDS;
  const raw = window.localStorage.getItem(SAVED_PLACES_STORAGE_KEY);
  if (raw === cachedRaw) return cachedIds;
  cachedRaw = raw;
  cachedIds = parseIds(raw);
  return cachedIds;
}

/** Current saved place ids, in the order they were saved. Empty on the server. */
export function getSavedPlaceIds(): string[] {
  return readSnapshot();
}

/** Whether a given place/boat-tour id is currently saved. */
export function isPlaceSaved(id: string): boolean {
  return getSavedPlaceIds().includes(id);
}

function persist(ids: string[]): string[] {
  if (isBrowser()) {
    const raw = JSON.stringify(ids);
    window.localStorage.setItem(SAVED_PLACES_STORAGE_KEY, raw);
    // Keep the cache authoritative immediately, rather than waiting for a
    // re-read to agree with what we just wrote.
    cachedRaw = raw;
    cachedIds = ids;
    window.dispatchEvent(new Event(SAVED_PLACES_CHANGE_EVENT));
  }
  return ids;
}

/** Adds an id if not already saved. Returns the resulting full list. */
export function addSavedPlace(id: string): string[] {
  const current = getSavedPlaceIds();
  if (current.includes(id)) return current;
  return persist([...current, id]);
}

/** Removes an id if present. Returns the resulting full list. */
export function removeSavedPlace(id: string): string[] {
  const current = getSavedPlaceIds();
  if (!current.includes(id)) return current;
  return persist(current.filter((existing) => existing !== id));
}

/** Flips saved state for an id. Returns the new list and whether it ended up saved. */
export function toggleSavedPlace(id: string): { ids: string[]; saved: boolean } {
  const current = getSavedPlaceIds();
  const willBeSaved = !current.includes(id);
  const ids = willBeSaved
    ? persist([...current, id])
    : persist(current.filter((existing) => existing !== id));
  return { ids, saved: willBeSaved };
}

/** Clears every saved id. Mostly useful for tests and a future "clear all" affordance. */
export function clearSavedPlaces(): string[] {
  return persist([]);
}

/**
 * Subscribes to changes in the saved list, from this tab (custom event) or
 * another tab on the same origin (native `storage` event). Returns an
 * unsubscribe function. No-ops on the server.
 */
export function subscribeSavedPlaces(callback: () => void): () => void {
  if (!isBrowser()) return () => {};

  const onChange = () => callback();
  const onStorage = (event: StorageEvent) => {
    // `key` is null when another tab cleared its whole localStorage; treat
    // that as a change too rather than assuming nothing relevant happened.
    if (event.key === null || event.key === SAVED_PLACES_STORAGE_KEY) callback();
  };

  window.addEventListener(SAVED_PLACES_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(SAVED_PLACES_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

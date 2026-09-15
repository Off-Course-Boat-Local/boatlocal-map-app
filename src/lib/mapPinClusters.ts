// Groups map pins that sit at (near enough) the same coordinate — most
// commonly several boat tours sharing one departure dock (e.g. Off Course's
// own Diana / Off The Beaten Path / Curaçao, all "Brouwersgracht 64") — so
// the map can show one marker per physical location instead of several
// fully overlapping pins a guest could never actually tap apart.

import type { MapPin } from "./data";

/**
 * Decimal places to round lat/lng to before grouping — ~1m of tolerance at
 * Amsterdam's latitude. Loose enough to still merge two pins geocoded from
 * the same address with a hair of floating-point/rounding drift, tight
 * enough that it never folds together two genuinely different addresses a
 * block apart.
 */
const LOCATION_PRECISION = 5;

function locationKey(p: Pick<MapPin, "lat" | "lng">): string {
  return `${p.lat.toFixed(LOCATION_PRECISION)},${p.lng.toFixed(LOCATION_PRECISION)}`;
}

/**
 * Groups pins by location. Cluster order follows each cluster's first pin's
 * position in the input array; pins within a cluster keep their relative
 * input order. A pin with no location neighbours is still returned as its
 * own one-item cluster, so callers never need a separate "ungrouped" case.
 */
export function groupPinsByLocation(pins: MapPin[]): MapPin[][] {
  const order: string[] = [];
  const byKey = new Map<string, MapPin[]>();
  for (const p of pins) {
    const key = locationKey(p);
    const existing = byKey.get(key);
    if (existing) {
      existing.push(p);
    } else {
      byKey.set(key, [p]);
      order.push(key);
    }
  }
  return order.map((key) => byKey.get(key)!);
}

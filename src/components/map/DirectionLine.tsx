"use client";

// The "it's that way" line — now a REAL walking route, drawn solid.
//
// HISTORY: this used to draw a dotted straight-line bearing between the
// guest and the selected place, deliberately never solid and never routed
// — "a straight line means follow this", and a straight line in Amsterdam
// happily crosses a gracht with no bridge, so a dotted "roughly this way"
// was the honest thing to show while the app's map was MapLibre +
// OpenFreeMap.
//
// That changed 2026-09-01: Google's Routes API can now legally render here,
// because the map itself switched to the Google Maps JavaScript API (see
// BaseMap.tsx's header comment) — Google's Routes API policy requires
// results DISPLAYED ON A MAP to be shown on a Google Map, which a
// MapLibre/OpenStreetMap canvas never satisfied no matter how the line was
// drawn. With a real route available, a real solid line is now the honest
// thing to show instead — see src/lib/walkingRoute.ts for the fetch and
// its own cost/compliance notes.
//
// NO STRAIGHT-LINE FALLBACK ANYMORE: this used to draw a dashed
// straight-line placeholder while the real route was in flight, so
// *something* was always on the map. In practice that meant every
// "Walking directions" tap flashed a dashed straight line, then snapped to
// the solid routed line a moment later — a visible flicker between the
// crow-flies guess and the real distance (founder report, 2026-09-15, with
// screenshots). Honesty now means showing nothing until the real route
// lands, not a placeholder that has to change shape the moment it does.

import { useEffect, useRef, useState } from "react";

import { DEFAULT_BRAND } from "@/lib/brand";

export interface Coordinate {
  lng: number;
  lat: number;
}

export interface RouteInfo {
  distanceMeters: number;
  durationSeconds: number;
}

export interface DirectionLineProps {
  /** The Google Map instance. Null while the map is still initialising. */
  map: google.maps.Map | null | undefined;
  /** Guest position. Null when location is denied/unavailable — renders nothing. */
  from: Coordinate | null | undefined;
  /** Selected place. Null when nothing is selected — renders nothing. */
  to: Coordinate | null | undefined;
  /**
   * Line colour. Defaults to reading `--brand-primary` off the map
   * container. Pass it explicitly when the brand can change while the map
   * stays mounted (a tenant switcher, a live preview in the Studio).
   */
  color?: string;
  /** Fired with the real route's distance/duration once fetched, or null when there's no real route (nothing selected, still loading, or the fetch failed). */
  onRouteInfo?: (info: RouteInfo | null) => void;
}

/** Reads the live brand colour from CSS custom properties (unchanged from the MapLibre version — this was never map-library-specific). */
export function readBrandPrimary(el?: HTMLElement | null): string {
  if (typeof window === "undefined") return DEFAULT_BRAND.primary;
  const target = el ?? document.documentElement;
  const value = getComputedStyle(target).getPropertyValue("--brand-primary").trim();
  return value || DEFAULT_BRAND.primary;
}

export const DIRECTION_LINE_WIDTH = 4;
export const DIRECTION_LINE_OPACITY = 0.85;

export function DirectionLine({ map, from, to, color, onRouteInfo }: DirectionLineProps) {
  // Primitive deps only — from/to are usually fresh object literals every
  // render, and depending on their identity would refetch/redraw on every
  // GPS tick (the exact bug fixed on the old dotted-line version — see git
  // history on this file from 2026-09-01 if that regression ever comes
  // back in a different shape).
  const fromLng = from?.lng ?? null;
  const fromLat = from?.lat ?? null;
  const toLng = to?.lng ?? null;
  const toLat = to?.lat ?? null;
  const hasLine = fromLng !== null && fromLat !== null && toLng !== null && toLat !== null;

  const [route, setRoute] = useState<{ path: Coordinate[]; info: RouteInfo } | null>(null);

  const onRouteInfoRef = useRef(onRouteInfo);
  useEffect(() => {
    onRouteInfoRef.current = onRouteInfo;
  });

  // Fetch a real route once per (guest, destination) pair — NOT on every
  // GPS tick. This is the one network/billed call this component makes;
  // see walkingRoute.ts's cost note for why that bound matters.
  useEffect(() => {
    // Cleared immediately on every change — including switching from one
    // selected place to another while hasLine stays true — so a caller
    // never shows the PREVIOUS place's distance/duration while the new
    // fetch is still in flight.
    setRoute(null);
    onRouteInfoRef.current?.(null);

    if (!hasLine) return;

    let cancelled = false;

    const params = new URLSearchParams({
      originLng: String(fromLng),
      originLat: String(fromLat),
      destLng: String(toLng),
      destLat: String(toLat),
    });

    void fetch(`/api/guest/walking-route?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { route?: { distanceMeters: number; durationSeconds: number; path: Coordinate[] } } | null) => {
        if (cancelled || !body?.route) return;
        const info = { distanceMeters: body.route.distanceMeters, durationSeconds: body.route.durationSeconds };
        setRoute({ path: body.route.path, info });
        onRouteInfoRef.current?.(info);
      })
      .catch(() => {
        // Swallowed — no route just means no line is drawn (see the effect
        // below), and a flaky network shouldn't surface as an app error
        // over a map line.
      });

    return () => {
      cancelled = true;
    };
  }, [hasLine, fromLng, fromLat, toLng, toLat]);

  // Only ever draw the real routed line, and only once it has actually
  // landed — nothing while it's in flight, nothing on failure. See the
  // header comment for why there is no placeholder in between anymore.
  useEffect(() => {
    if (!map || !hasLine || !route) return;

    const paintColor = color ?? readBrandPrimary(map.getDiv());

    const polyline = new google.maps.Polyline({
      path: route.path,
      strokeColor: paintColor,
      strokeOpacity: DIRECTION_LINE_OPACITY,
      strokeWeight: DIRECTION_LINE_WIDTH,
      clickable: false,
    });
    polyline.setMap(map);

    return () => {
      polyline.setMap(null);
    };
  }, [map, hasLine, color, route]);

  return null;
}

export default DirectionLine;

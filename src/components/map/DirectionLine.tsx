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
// STILL DASHED, ON PURPOSE, WHEN THERE'S NO REAL ROUTE: a route fetch can
// fail (network hiccup, no path found) — the straight-line fallback below
// stays dashed specifically so it never LOOKS like a real route when it
// isn't one. Same honesty principle the original dotted line encoded, just
// narrowed to the one case it's still needed for.

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
  /** Fired with the real route's distance/duration once fetched, or null when there's no real route (nothing selected, or the fetch failed and the fallback straight line is showing instead). */
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

/** Google's documented recipe for a dashed Polyline: an invisible stroke plus a repeating dash symbol. */
function dashedLineIcons(color: string): google.maps.IconSequence[] {
  return [
    {
      icon: {
        path: "M 0,-1 0,1",
        strokeOpacity: DIRECTION_LINE_OPACITY,
        strokeColor: color,
        scale: 3,
      },
      offset: "0",
      repeat: "16px",
    },
  ];
}

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
        // Swallowed — the fallback straight line (drawn below) covers this,
        // and a flaky network shouldn't surface as an app error over a map
        // line.
      });

    return () => {
      cancelled = true;
    };
  }, [hasLine, fromLng, fromLat, toLng, toLat]);

  // Draw whichever line is current: the real route once it lands, else the
  // dashed straight-line fallback — never both, never neither while
  // hasLine is true.
  useEffect(() => {
    if (!map || !hasLine) return;

    const paintColor = color ?? readBrandPrimary(map.getDiv());
    const path: Coordinate[] = route?.path ?? [
      { lng: fromLng as number, lat: fromLat as number },
      { lng: toLng as number, lat: toLat as number },
    ];

    const polyline = new google.maps.Polyline(
      route
        ? {
            path,
            strokeColor: paintColor,
            strokeOpacity: DIRECTION_LINE_OPACITY,
            strokeWeight: DIRECTION_LINE_WIDTH,
            clickable: false,
          }
        : {
            path,
            strokeOpacity: 0,
            icons: dashedLineIcons(paintColor),
            clickable: false,
          },
    );
    polyline.setMap(map);

    return () => {
      polyline.setMap(null);
    };
  }, [map, hasLine, fromLng, fromLat, toLng, toLat, color, route]);

  return null;
}

export default DirectionLine;

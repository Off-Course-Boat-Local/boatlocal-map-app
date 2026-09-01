"use client";

// BaseMap — the Google Maps wrapper everything else composes onto.
//
// Switched from MapLibre + OpenFreeMap to the Google Maps JavaScript API
// (2026-09-01), specifically so DirectionLine's route can legally render
// on-map: Google's Routes API policy requires results displayed on a map to
// be shown on a GOOGLE map — a MapLibre/OpenStreetMap canvas (what this app
// used until now) never satisfies that, no matter how the line is drawn.
// See DirectionLine.tsx's header comment for the fuller compliance story.
//
// Design notes for the components that sit on top of this (Pin,
// DirectionLine, PlaceCard, …) — same shape the MapLibre version had:
//
//  * The map instance is put on React context. Call `useMapInstance()`
//    from any descendant to get it, or pass `onMapReady`.
//  * `children` render as soon as the map object exists.
//  * The Google Maps JS API is loaded dynamically inside an effect via
//    @googlemaps/js-api-loader. It touches `window` at module scope, so a
//    static import would break the server render of any page that mounts
//    this component.
//  * Custom DOM markers (Pin, GuestDot) use google.maps.OverlayView rather
//    than the newer AdvancedMarkerElement — Advanced Markers require a
//    cloud-configured Map ID (or the explicitly non-production
//    'DEMO_MAP_ID'), which this app doesn't have; OverlayView needs
//    neither a Map ID nor cloud-based styling, so the plain client-side
//    `styles` array below keeps working exactly like it always has.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { GOOGLE_MAP_STYLE } from "@/lib/googleMapStyle";

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const MapInstanceContext = createContext<google.maps.Map | null>(null);

/**
 * The live Google Map, or null if called outside a <BaseMap>.
 */
export function useMapInstance(): google.maps.Map | null {
  return useContext(MapInstanceContext);
}

/* ------------------------------------------------------------------ */
/*  Loader (module-level singleton — @googlemaps/js-api-loader already   */
/*  dedupes the underlying <script> tag, but the import itself is only   */
/*  worth doing once per module rather than once per <BaseMap>).         */
/* ------------------------------------------------------------------ */

let mapsLibraryPromise: Promise<google.maps.MapsLibrary> | null = null;

function loadMapsLibrary(): Promise<google.maps.MapsLibrary> {
  mapsLibraryPromise ??= (async () => {
    // @googlemaps/js-api-loader v2's functional API — the old `Loader`
    // class is deprecated in favour of this (setOptions must run before
    // the first importLibrary call, so this whole module-level singleton
    // exists specifically to guarantee that ordering across every <BaseMap>
    // that ever mounts, not just the first one).
    const { setOptions, importLibrary } = await import("@googlemaps/js-api-loader");
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set. Check .env.local.");
    setOptions({ key: apiKey, v: "weekly" });
    return importLibrary("maps");
  })();
  return mapsLibraryPromise;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface BaseMapProps {
  center: { lng: number; lat: number };
  zoom: number;
  className?: string;
  /** Defaults to GOOGLE_MAP_STYLE — the illustrated look ported from the old MapLibre style. */
  mapStyle?: google.maps.MapTypeStyle[];
  minZoom?: number;
  maxZoom?: number;
  /** Set false for a static decorative map. */
  interactive?: boolean;
  /** Fired once, after the map object exists. */
  onMapReady?: (map: google.maps.Map) => void;
  /** Fired on every idle (Google's equivalent of MapLibre's moveend — pan/zoom settled) — handy for a zoom readout or lazy loading. */
  onMoveEnd?: (map: google.maps.Map) => void;
  /** Rendered once the map object exists. */
  children?: ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function BaseMap({
  center,
  zoom,
  className,
  mapStyle,
  minZoom = 10,
  maxZoom = 18,
  interactive = true,
  onMapReady,
  onMoveEnd,
  children,
}: BaseMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Keep the latest callbacks without re-creating the map when they change.
  const onMapReadyRef = useRef(onMapReady);
  const onMoveEndRef = useRef(onMoveEnd);
  useEffect(() => {
    onMapReadyRef.current = onMapReady;
    onMoveEndRef.current = onMoveEnd;
  });

  // Initial camera + style are read once, on mount. Changing them later is
  // the caller's job via `useMapInstance()` (panTo / setOptions) —
  // remounting the map on every prop tick would be miserable to interact
  // with. Same contract the MapLibre version had.
  const initialRef = useRef({ center, zoom, mapStyle, interactive });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let created: google.maps.Map | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let idleListener: google.maps.MapsEventListener | null = null;

    void (async () => {
      const { Map: GoogleMap } = await loadMapsLibrary();
      if (cancelled) return;

      const init = initialRef.current;
      const instance = new GoogleMap(container, {
        center: { lat: init.center.lat, lng: init.center.lng },
        zoom: init.zoom,
        minZoom,
        maxZoom,
        styles: init.mapStyle ?? GOOGLE_MAP_STYLE,
        // The illustrated look is a flat printed page — no tilt, no
        // rotate, matching the old `pitchWithRotate: false` /
        // `dragRotate: false` MapLibre options.
        tilt: 0,
        heading: 0,
        rotateControl: false,
        // No default chrome — this app draws its own filter pills/header,
        // not Google's zoom buttons or map-type switcher.
        disableDefaultUI: true,
        zoomControl: false,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        keyboardShortcuts: false,
        // POIs are hidden via the style array anyway; this also stops a
        // stray default Google POI info window from popping up over a
        // guide's own curated pins.
        clickableIcons: false,
        gestureHandling: init.interactive ? "greedy" : "none",
        disableDoubleClickZoom: !init.interactive,
        draggable: init.interactive,
      });

      if (process.env.NODE_ENV !== "production") {
        // Handy when tuning the style from the devtools console.
        (window as unknown as { __map?: google.maps.Map }).__map = instance;
      }
      created = instance;
      mapRef.current = instance;

      idleListener = instance.addListener("idle", () => onMoveEndRef.current?.(instance));

      // Keep the map matched to the container for the whole of its life.
      // Google Maps samples the container size at construction time same
      // as MapLibre did — a container inside a responsive frame can still
      // be 0×0 on the very first layout pass, so this corrects it the
      // moment real layout lands, same reasoning the MapLibre version's
      // ResizeObserver had (just `resize` trigger instead of `.resize()`).
      resizeObserver = new ResizeObserver(() => {
        google.maps.event.trigger(instance, "resize");
      });
      resizeObserver.observe(container);

      setMap(instance);
      onMapReadyRef.current?.(instance);
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      resizeObserver = null;
      idleListener?.remove();
      idleListener = null;
      mapRef.current = null;
      setMap(null);
      // Google Maps has no `.remove()`/dispose — clearing listeners and
      // letting the container (and the Map instance with it) get garbage
      // collected on unmount is the documented cleanup story.
      void created;
    };
    // Intentionally mount-only. See `initialRef` above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Two divs on purpose — same reasoning the MapLibre version had: the
  // caller's className goes on a wrapper Google Maps never touches, and
  // Google's container simply fills it at 100%/100%. `children` render as
  // an overlay sibling. The wrapper must be given a definite size by
  // `className` (`absolute inset-0`, `h-dvh w-full`, `h-96` …).
  return (
    <div className={className}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <MapInstanceContext.Provider value={map}>
        {map ? children : null}
      </MapInstanceContext.Provider>
    </div>
  );
}

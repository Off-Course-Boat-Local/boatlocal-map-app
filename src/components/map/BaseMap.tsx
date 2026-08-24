"use client";

// BaseMap — the MapLibre wrapper everything else composes onto.
//
// Design notes for the components that will sit on top of this (Pin,
// DirectionLine, PlaceCard, …):
//
//  * The map instance is put on React context. Call `useMapInstance()`
//    from any descendant to get it, or pass `onMapReady`.
//  * `children` render as soon as the map object exists. `new Marker()`
//    is safe immediately; `addSource`/`addLayer` must guard on the style
//    themselves, because a map in a hidden tab never loads one.
//  * maplibre-gl is imported dynamically inside an effect. It touches
//    `window` at module scope, so a static import would break the
//    server render of any page that mounts this component.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  MapLibreMap,
  MapOptions,
  StyleSpecification,
} from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import { buildMapStyle } from "@/lib/mapStyle";

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const MapInstanceContext = createContext<MapLibreMap | null>(null);

/**
 * The live MapLibre map, or null if called outside a <BaseMap> (or before
 * the style has loaded — though children only mount after that).
 */
export function useMapInstance(): MapLibreMap | null {
  return useContext(MapInstanceContext);
}

/* ------------------------------------------------------------------ */
/*  Web worker plumbing (Next.js bundler workaround)                   */
/* ------------------------------------------------------------------ */

/**
 * maplibre-gl v6 finds its web worker with
 *
 *   new URL("./maplibre-gl-worker.mjs", import.meta.url)
 *
 * which under Next resolves against the *bundled chunk* —
 * `/_next/static/chunks/maplibre-gl-worker.mjs`, a 404. Worse, the failure
 * is entirely silent: no console error, no `error` event; every tile just
 * sits in state `"loading"` forever and you stare at an empty background
 * colour wondering what you got wrong in the style.
 *
 * `new URL("maplibre-gl/dist/…", import.meta.url)` *does* make the bundler
 * emit each file as a static asset, but it emits them with hashed names
 * into a flat directory, so the worker's own
 * `import … from "./maplibre-gl-shared.mjs"` then 404s too.
 *
 * So: fetch the emitted worker source, rewrite its relative import to the
 * emitted (hashed) URL of its dependency, and hand maplibre a same-origin
 * blob. Both files still come from node_modules via the bundler, so there
 * is nothing vendored, nothing to keep in sync and no CDN in the critical
 * path.
 *
 * See the spike report — this deserves a permanent fix (a postinstall copy
 * into `public/`, or a bundler asset rule) rather than living here.
 */
let workerUrlPromise: Promise<string> | null = null;

function resolveWorkerUrl(): Promise<string> {
  workerUrlPromise ??= (async () => {
    const workerAsset = new URL(
      "maplibre-gl/dist/maplibre-gl-worker.mjs",
      import.meta.url,
    ).href;
    // The bundler rewrites these to root-relative paths ("/_next/static/…").
    // They must be made absolute before they go into the blob: a blob: URL
    // is not hierarchical, so a root-relative specifier inside a blob module
    // fails to resolve — and the resulting worker error carries no message,
    // filename or line number at all.
    const sharedAsset = new URL(
      new URL("maplibre-gl/dist/maplibre-gl-shared.mjs", import.meta.url).href,
      window.location.href,
    ).href;

    const res = await fetch(workerAsset);
    if (!res.ok) throw new Error(`worker asset ${res.status}`);
    const src = (await res.text()).replace(
      /(["'])\.\/maplibre-gl-shared\.mjs\1/g,
      JSON.stringify(sharedAsset),
    );

    return URL.createObjectURL(
      new Blob([src], { type: "text/javascript" }),
    );
  })();
  return workerUrlPromise;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface BaseMapProps {
  center: { lng: number; lat: number };
  zoom: number;
  className?: string;
  /** Defaults to the Boat Local illustrated style. */
  mapStyle?: StyleSpecification;
  minZoom?: number;
  maxZoom?: number;
  /** Set false for a static decorative map. */
  interactive?: boolean;
  /** Fired once, after the initial style has loaded. */
  onMapReady?: (map: MapLibreMap) => void;
  /** Fired on every moveend — handy for a zoom readout or lazy loading. */
  onMoveEnd?: (map: MapLibreMap) => void;
  /**
   * Rendered once the map object exists — NOT once its style has loaded.
   * Markers work immediately; anything calling addSource/addLayer must wait
   * for its own style signal. See the note at the `ready()` call site.
   */
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
  const mapRef = useRef<MapLibreMap | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);

  // Keep the latest callbacks without re-creating the map when they change.
  const onMapReadyRef = useRef(onMapReady);
  const onMoveEndRef = useRef(onMoveEnd);
  useEffect(() => {
    onMapReadyRef.current = onMapReady;
    onMoveEndRef.current = onMoveEnd;
  });

  // Initial camera + style are read once, on mount. Changing them later is
  // the caller's job via `useMapInstance()` (flyTo / setStyle) — remounting
  // the map on every prop tick would be miserable to interact with.
  const initialRef = useRef({ center, zoom, mapStyle, interactive });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let created: MapLibreMap | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let onVisible: (() => void) | null = null;

    void (async () => {
      // maplibre-gl v6 is ESM with named exports and no default export.
      const { Map: MapLibreGLMap, setWorkerUrl, getWorkerUrl } = await import(
        "maplibre-gl"
      );
      if (!getWorkerUrl()) setWorkerUrl(await resolveWorkerUrl());
      // Everything from here down is synchronous, so the cleanup below is
      // guaranteed to see `created`.
      if (cancelled) return;

      const init = initialRef.current;
      const options: MapOptions = {
        container,
        style: init.mapStyle ?? buildMapStyle(),
        center: [init.center.lng, init.center.lat],
        zoom: init.zoom,
        minZoom,
        maxZoom,
        interactive: init.interactive,
        attributionControl: { compact: true },
        // The illustrated look is a flat printed page — no tilt, no rotate.
        pitchWithRotate: false,
        dragRotate: false,
      };

      const instance = new MapLibreGLMap(options);

      // `attributionControl: { compact: true }` above only makes the
      // control STYLABLE as a small pill — it doesn't start collapsed.
      // MapLibre renders it as a native `<details open>` element and sets
      // `open` by default, so without this it shows the full "OpenFreeMap
      // · OpenMapTiles · © OpenStreetMap" credit line open on every load
      // before a guest can collapse it themselves. Attribution still has to
      // stay reachable — that's a real term of OpenFreeMap/OpenStreetMap's
      // usage, not just cosmetic — so this closes the <details> rather than
      // removing the control: the ⓘ toggle is still there, tap it and the
      // same text opens right back up.
      //
      // Collapsing ONCE at construction is not enough (that was the first
      // version of this fix, and it regressed the moment it met real data):
      // the control starts out attribution-EMPTY, and when the style's
      // sources land their attribution strings, MapLibre's _updateCompact
      // re-adds `open` + `maplibregl-compact-show` as part of upgrading the
      // control to its compact form for the first time. So: collapse
      // synchronously (kills the pre-style flash), then again on "load" and
      // "idle" (kills the post-population reopen — by then the control has
      // its `maplibregl-compact` class, and MapLibre only force-opens while
      // that class is still missing, so it stays closed afterwards and the
      // guest's own ⓘ taps are never fought). "load"/"idle" never firing in
      // a hidden tab is fine here — the reopen only matters once someone is
      // actually looking.
      const collapseAttribution = () => {
        const attrib = instance.getContainer().querySelector(".maplibregl-ctrl-attrib");
        attrib?.removeAttribute("open");
        attrib?.classList.remove("maplibregl-compact-show");
      };
      collapseAttribution();
      instance.once("load", collapseAttribution);
      instance.once("idle", collapseAttribution);

      instance.touchZoomRotate.disableRotation();
      if (process.env.NODE_ENV !== "production") {
        // Handy when tuning the style from the devtools console.
        (window as unknown as { __map?: MapLibreMap }).__map = instance;
        instance.on("error", (e) => console.error("[maplibre]", e.error));
      }
      created = instance;
      mapRef.current = instance;

      instance.on("moveend", () => onMoveEndRef.current?.(instance));

      // Keep the canvas matched to the container for the whole of the map's
      // life, starting immediately — NOT once the map is "ready".
      //
      // maplibre samples the container size in its constructor. The container
      // here is inside a responsive frame, and the map module is imported
      // dynamically, so it is entirely normal for the constructor to run
      // before layout has given the container a size — at which point
      // maplibre silently falls back to 400x300 and never recovers on its
      // own. Observing from this moment on means the very first layout pass
      // corrects it.
      resizeObserver = new ResizeObserver(() => instance.resize());
      resizeObserver.observe(container);

      let readyFired = false;
      const ready = () => {
        if (cancelled || readyFired) return;
        readyFired = true;
        instance.resize();
        setMap(instance);
        onMapReadyRef.current?.(instance);
      };

      // Ready as soon as the map OBJECT exists — deliberately not when its
      // style has loaded.
      //
      // Every style-based signal is unusable here, because MapLibre does no
      // work at all while `document.hidden` is true: it does not fetch the
      // style, so `isStyleLoaded()` never flips, `load` never fires, and
      // `styledata` never arrives. Anything that waits on those waits forever.
      // That is not a corner case — a QR scanner opening the guide in a
      // background tab hits it every time, and the guest comes back to a blank
      // map that never recovers.
      //
      // So children mount against a live-but-not-yet-styled map, and anything
      // that needs the style guards for itself. Markers (pins, the guest dot)
      // work immediately. DirectionLine already waits for its own style
      // signal before calling addSource/addLayer.
      ready();

      // Kick the map when the page becomes visible. MapLibre starts its render
      // loop from requestAnimationFrame, which does not run while hidden, so a
      // map created in a background tab needs a nudge to begin loading once
      // the guest actually looks at it.
      onVisible = () => {
        if (document.hidden) return;
        instance.resize();
        instance.triggerRepaint();
      };
      document.addEventListener("visibilitychange", onVisible);
    })();

    return () => {
      cancelled = true;
      if (onVisible) document.removeEventListener("visibilitychange", onVisible);
      onVisible = null;
      resizeObserver?.disconnect();
      resizeObserver = null;
      const m = created ?? mapRef.current;
      mapRef.current = null;
      setMap(null);
      m?.remove();
    };
    // Intentionally mount-only. See `initialRef` above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Two divs on purpose, and this is not cosmetic.
  //
  // maplibre-gl.css ships `.maplibregl-map { position: relative }` as
  // UNLAYERED css. Tailwind v4 puts its utilities inside `@layer utilities`,
  // and unlayered rules always beat layered ones regardless of specificity —
  // so putting `absolute inset-0` straight onto maplibre's own container
  // silently collapses the map to 0px high. Took a while to find.
  //
  // So: the caller's className goes on a wrapper that maplibre never
  // touches, and maplibre's container simply fills it at 100%/100%.
  // `children` render as an overlay sibling of the canvas.
  //
  // The wrapper must therefore be given a definite size by `className`
  // (`absolute inset-0`, `h-dvh w-full`, `h-96` …), and should be
  // positioned if any children need to overlay the map.
  return (
    <div className={className}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <MapInstanceContext.Provider value={map}>
        {map ? children : null}
      </MapInstanceContext.Provider>
    </div>
  );
}

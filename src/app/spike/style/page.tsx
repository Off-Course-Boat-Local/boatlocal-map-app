"use client";

// Spike page: does MapLibre + OSM vector tiles actually look like an
// illustrated tourist map?
//
// Full-viewport map, plus a small HUD showing live zoom and a toggle
// between the two label strategies (see the note on serif below).
//
// STANDALONE MapLibre mount, not the shared <BaseMap> — BaseMap switched to
// the Google Maps JavaScript API (2026-09-01, see its own header comment
// for why), which has no use for mapStyle.ts's MapLibre StyleSpecification
// at all. This page's whole point is evaluating that MapLibre style, which
// is still worth keeping around as a reference even though it's no longer
// what production renders — so it now carries its own small, self-contained
// MapLibre mount instead of sharing BaseMap's (Google Maps) one.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { AMSTERDAM_CENTER } from "@/lib/data";
import { GEO_LABELS, MAP_COLORS, buildMapStyle } from "@/lib/mapStyle";

type LabelMode = "glyph" | "serif";

const GLYPH_STYLE = buildMapStyle();
const NO_LABEL_STYLE = buildMapStyle({ geoLabels: false });

/**
 * Same maplibre-gl v6 web-worker-URL workaround BaseMap.tsx used to carry —
 * still required for MapLibre to render anything at all under Next's
 * bundler, regardless of which page mounts it. See the old BaseMap.tsx git
 * history (before 2026-09-01) for the full story if this ever needs
 * touching again.
 */
let workerUrlPromise: Promise<string> | null = null;

function resolveWorkerUrl(): Promise<string> {
  workerUrlPromise ??= (async () => {
    const workerAsset = new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href;
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
    return URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
  })();
  return workerUrlPromise;
}

function useStandaloneMapLibre(mapStyle: StyleSpecification) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let created: MapLibreMap | null = null;

    void (async () => {
      const { Map, setWorkerUrl, getWorkerUrl } = await import("maplibre-gl");
      if (!getWorkerUrl()) setWorkerUrl(await resolveWorkerUrl());
      if (cancelled) return;

      const instance = new Map({
        container,
        style: mapStyle,
        center: [AMSTERDAM_CENTER.lng, AMSTERDAM_CENTER.lat],
        zoom: AMSTERDAM_CENTER.zoom,
        pitchWithRotate: false,
        dragRotate: false,
      });
      created = instance;
      instance.once("load", () => {
        if (!cancelled) setMap(instance);
      });
    })();

    return () => {
      cancelled = true;
      created?.remove();
      setMap(null);
    };
  }, [mapStyle]);

  return { containerRef, map };
}

export default function StyleSpikePage() {
  const [mode, setMode] = useState<LabelMode>("serif");
  const { containerRef, map } = useStandaloneMapLibre(mode === "glyph" ? GLYPH_STYLE : NO_LABEL_STYLE);
  const [zoom, setZoom] = useState(AMSTERDAM_CENTER.zoom);

  const handleMoveEnd = useCallback(() => {
    if (map) setZoom(map.getZoom());
  }, [map]);

  useEffect(() => {
    if (!map) return;
    setZoom(map.getZoom());
    map.on("moveend", handleMoveEnd);
    return () => {
      map.off("moveend", handleMoveEnd);
    };
  }, [map, handleMoveEnd]);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />
      {mode === "serif" ? <SerifGeoLabels map={map} zoom={zoom} /> : null}

      <div
        className="pointer-events-auto absolute left-4 top-4 z-10 flex flex-col gap-2 rounded-xl px-3 py-2.5 text-[11px] leading-tight shadow-sm"
        style={{
          background: "rgba(231,234,219,0.88)",
          color: "#6E6C58",
          backdropFilter: "blur(6px)",
        }}
      >
        <div className="font-semibold tracking-wide uppercase opacity-70">
          Illustrated style spike
        </div>
        <div>
          zoom <span className="tabular-nums font-semibold">{zoom.toFixed(2)}</span>
        </div>
        <div className="flex gap-1">
          {(["serif", "glyph"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="rounded-full px-2.5 py-1 text-[11px] transition"
              style={{
                background: mode === m ? "#8C8A72" : "rgba(140,138,114,0.14)",
                color: mode === m ? "#F2F4E9" : "#6E6C58",
              }}
            >
              {m === "serif" ? "DOM serif labels" : "Glyph labels"}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  DOM serif labels                                                   */
/* ------------------------------------------------------------------ */

/**
 * OpenFreeMap only serves Noto Sans Regular/Italic/Bold as glyph PBFs, so
 * a true italic *serif* is impossible inside the style itself without
 * self-hosting glyphs. There are only twelve labels on this map and they
 * never collide, so rendering them as absolutely-positioned DOM nodes
 * gives us any typeface the browser has — here a real old-style serif.
 *
 * This lives in the spike page rather than in BaseMap on purpose: it is
 * an evaluation of the option, not yet a committed architecture.
 */
function SerifGeoLabels({ map, zoom }: { map: MapLibreMap | null; zoom: number }) {
  const [, force] = useState(0);

  // Re-project on every frame of movement.
  useEffect(() => {
    if (!map) return;
    const rerender = () => force((n) => n + 1);
    map.on("move", rerender);
    map.on("resize", rerender);
    return () => {
      map.off("move", rerender);
      map.off("resize", rerender);
    };
  }, [map]);

  if (!map) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      {GEO_LABELS.map((label, i) => {
        if (zoom < label.minzoom) return null;
        const p = map.project([label.lng, label.lat]);
        const size =
          (label.kind === "landmark" ? 13 : 12) *
          Math.min(1.55, Math.max(0.85, 1 + (zoom - 13) * 0.14));
        const color =
          label.kind === "water" ? MAP_COLORS.labelWater : MAP_COLORS.labelLand;
        return (
          <span
            key={`${label.name}-${i}`}
            className="absolute whitespace-nowrap"
            style={{
              left: p.x,
              top: p.y,
              transform: "translate(-50%, -50%)",
              fontFamily:
                '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif',
              fontStyle: "italic",
              fontSize: size,
              letterSpacing: "0.06em",
              color,
              textShadow: `0 0 3px ${
                label.kind === "water" ? MAP_COLORS.water : MAP_COLORS.labelHalo
              }, 0 0 6px ${
                label.kind === "water" ? MAP_COLORS.water : MAP_COLORS.labelHalo
              }`,
            }}
          >
            {label.name}
          </span>
        );
      })}
    </div>
  );
}

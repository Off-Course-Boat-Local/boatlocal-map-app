"use client";

// Spike page: does MapLibre + OSM vector tiles actually look like an
// illustrated tourist map?
//
// Full-viewport map, plus a small HUD showing live zoom and a toggle
// between the two label strategies (see the note on serif below).

import { useCallback, useEffect, useState } from "react";
import type { MapLibreMap } from "maplibre-gl";

import BaseMap, { useMapInstance } from "@/components/map/BaseMap";
import { AMSTERDAM_CENTER } from "@/lib/data";
import { GEO_LABELS, MAP_COLORS, buildMapStyle } from "@/lib/mapStyle";

type LabelMode = "glyph" | "serif";

const GLYPH_STYLE = buildMapStyle();
const NO_LABEL_STYLE = buildMapStyle({ geoLabels: false });

export default function StyleSpikePage() {
  const [mode, setMode] = useState<LabelMode>("serif");
  const [zoom, setZoom] = useState(AMSTERDAM_CENTER.zoom);

  const handleReady = useCallback((map: MapLibreMap) => {
    setZoom(map.getZoom());
  }, []);

  const handleMoveEnd = useCallback((map: MapLibreMap) => {
    setZoom(map.getZoom());
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      {/* Remounting on mode change is fine here — it's a spike toggle. */}
      <BaseMap
        key={mode}
        center={AMSTERDAM_CENTER}
        zoom={AMSTERDAM_CENTER.zoom}
        mapStyle={mode === "glyph" ? GLYPH_STYLE : NO_LABEL_STYLE}
        className="absolute inset-0"
        onMapReady={handleReady}
        onMoveEnd={handleMoveEnd}
      >
        {mode === "serif" ? <SerifGeoLabels zoom={zoom} /> : null}
      </BaseMap>

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
function SerifGeoLabels({ zoom }: { zoom: number }) {
  const map = useMapInstance();
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

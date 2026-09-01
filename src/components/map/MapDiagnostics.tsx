"use client";

// On-screen diagnostics for device testing.
//
// There is no remote console on someone else's phone, so the facts that
// actually distinguish the failure modes get rendered where a tester can read
// them out: WebGL support, document visibility, and whether the map/tiles
// have actually loaded.
//
// Ported from a MapLibre-specific version (style.sourceCaches tile counts,
// the .maplibregl-marker DOM class) to Google Maps' own signals when the map
// switched — see BaseMap.tsx's header comment. Pin/marker count is no
// longer independently verifiable this way (this app's pins are plain
// OverlayView divs with no distinguishing class — see DomOverlay.ts), so
// that line just trusts `expectedPins` now.
//
// Spike-only. This never ships to a guest.

import { useEffect, useState } from "react";

export interface MapDiagnosticsProps {
  map: google.maps.Map | null;
  /** Marker count is owned by the page, not discoverable from the map. */
  expectedPins: number;
}

interface Snapshot {
  webgl2: boolean;
  hidden: boolean;
  secure: boolean;
  vw: number;
  dpr: number;
  styleLoaded: boolean;
  mapLoaded: boolean;
  markers: number;
  tiles: number;
  err: string;
}

function detectWebgl2(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

export default function MapDiagnostics({
  map,
  expectedPins,
}: MapDiagnosticsProps) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [tilesLoaded, setTilesLoaded] = useState(false);

  useEffect(() => {
    if (!map) return;
    const listener = google.maps.event.addListenerOnce(map, "tilesloaded", () => {
      setTilesLoaded(true);
    });
    return () => listener.remove();
  }, [map]);

  useEffect(() => {
    const read = () => {
      setSnap({
        webgl2: detectWebgl2(),
        hidden: document.hidden,
        secure: window.isSecureContext,
        vw: window.innerWidth,
        dpr: Math.round(window.devicePixelRatio * 100) / 100,
        styleLoaded: tilesLoaded,
        mapLoaded: !!map,
        markers: expectedPins,
        tiles: tilesLoaded ? 1 : 0,
        err: "",
      });
    };

    read();
    const id = setInterval(read, 1000);
    return () => clearInterval(id);
  }, [map, tilesLoaded, expectedPins]);

  if (!snap) return null;

  const bad = (v: boolean) => (v ? "#2E7D52" : "#C93B2C");

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-50 px-2 pt-2"
      style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
    >
      <div className="rounded-lg bg-black/85 px-2.5 py-2 text-[10px] leading-[1.5] text-white">
        <div>
          <span style={{ color: bad(snap.webgl2) }}>
            webgl2:{snap.webgl2 ? "yes" : "NO"}
          </span>
          {"  "}hidden:{String(snap.hidden)}
          {"  "}secure:{String(snap.secure)}
        </div>
        <div>
          vw:{snap.vw}
          {"  "}dpr:{snap.dpr}
          {"  "}mapObj:{map ? "yes" : "NO"}
        </div>
        <div>
          <span style={{ color: bad(snap.styleLoaded) }}>
            style:{snap.styleLoaded ? "loaded" : "NOT"}
          </span>
          {"  "}
          <span style={{ color: bad(snap.mapLoaded) }}>
            map:{snap.mapLoaded ? "loaded" : "NOT"}
          </span>
        </div>
        <div>
          <span style={{ color: bad(snap.markers > 0) }}>
            pins:{snap.markers}/{expectedPins}
          </span>
          {"  "}
          <span style={{ color: bad(snap.tiles > 0) }}>tiles:{snap.tiles}</span>
        </div>
        {snap.err ? (
          <div style={{ color: "#FF8A7A" }}>err: {snap.err.slice(0, 120)}</div>
        ) : null}
      </div>
    </div>
  );
}

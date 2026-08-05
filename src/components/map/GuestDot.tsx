"use client";

// The guest's own position — a blue dot with a soft halo.
//
// Same portal-into-a-Marker trick as MapPins: MapLibre owns the positioning,
// React owns the pixels. The halo is a fixed size rather than an accuracy
// circle: a true accuracy radius in a dense city is often 50m+, which draws
// a dinner-plate-sized blob over half the canal ring and reads as an error.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Marker as MapLibreMarker } from "maplibre-gl";

import { useMapInstance } from "./BaseMap";

export interface GuestDotProps {
  position: { lng: number; lat: number } | null;
}

export default function GuestDot({ position }: GuestDotProps) {
  const map = useMapInstance();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);

  useEffect(() => {
    if (!map || !position) return;
    let cancelled = false;

    (async () => {
      const { Marker } = await import("maplibre-gl");
      if (cancelled) return;
      const el = document.createElement("div");
      const marker = new Marker({ element: el, anchor: "center" })
        .setLngLat([position.lng, position.lat])
        .addTo(map);
      markerRef.current = marker;
      setContainer(el);
    })();

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      setContainer(null);
    };
  }, [map, position]);

  if (!container) return null;

  return createPortal(
    <div className="relative h-[46px] w-[46px]">
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: "var(--brand-primary)", opacity: 0.18 }}
      />
      <span
        className="absolute left-1/2 top-1/2 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{ background: "var(--brand-primary)" }}
      />
    </div>,
    container,
  );
}

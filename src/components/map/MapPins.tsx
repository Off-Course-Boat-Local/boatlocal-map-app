"use client";

// Positions <Pin> components on the map.
//
// Each pin gets a real MapLibre Marker (so it tracks the map through pan,
// zoom and rotation for free), but the marker's element is an empty div that
// we render the React <Pin> into via a portal. That keeps Pin a pure
// presentational component with no MapLibre dependency — which is why it
// could be built by a different person in parallel with the map itself.
//
// anchor: "bottom" matches Pin's contract: the teardrop's point sits on the
// coordinate.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Marker as MapLibreMarker } from "maplibre-gl";

import Pin from "./Pin";
import { useMapInstance } from "./BaseMap";
import type { MapPin } from "@/lib/data";

export interface MapPinsProps {
  pins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function MapPins({ pins, selectedId, onSelect }: MapPinsProps) {
  const map = useMapInstance();
  const [containers, setContainers] = useState<Record<string, HTMLElement>>({});
  const markersRef = useRef<MapLibreMarker[]>([]);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    (async () => {
      const { Marker } = await import("maplibre-gl");
      if (cancelled) return;

      const created: MapLibreMarker[] = [];
      const next: Record<string, HTMLElement> = {};

      for (const p of pins) {
        const el = document.createElement("div");
        el.style.cursor = "pointer";
        el.style.willChange = "transform";
        const marker = new Marker({ element: el, anchor: "bottom" })
          .setLngLat([p.lng, p.lat])
          .addTo(map);
        created.push(marker);
        next[p.id] = el;
      }

      markersRef.current = created;
      setContainers(next);
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      setContainers({});
    };
  }, [map, pins]);

  return (
    <>
      {pins.map((p) => {
        const el = containers[p.id];
        if (!el) return null;
        return createPortal(
          <Pin
            category={p.categories[0]}
            selected={selectedId === p.id}
            label={p.name}
            onClick={() => onSelect(p.id)}
          />,
          el,
          p.id,
        );
      })}
    </>
  );
}

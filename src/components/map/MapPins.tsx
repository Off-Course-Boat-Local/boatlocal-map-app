"use client";

// Positions <Pin> components on the map.
//
// Each pin gets a real overlay (DomOverlay.ts — Google Maps' OverlayView,
// see that file's header for why not AdvancedMarkerElement) so it tracks
// the map through pan and zoom for free, and the overlay's element is an
// empty div that we render the React <Pin> into via a portal. That keeps
// Pin a pure presentational component with no map-library dependency —
// which is why it could be built by a different person in parallel with
// the map itself.
//
// anchor: "bottom" matches Pin's contract: the teardrop's point sits on the
// coordinate.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import Pin from "./Pin";
import { useMapInstance } from "./BaseMap";
import { createDomOverlay, type DomOverlayHandle } from "./DomOverlay";
import type { MapPin } from "@/lib/data";

export interface MapPinsProps {
  pins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function MapPins({ pins, selectedId, onSelect }: MapPinsProps) {
  const map = useMapInstance();
  const [containers, setContainers] = useState<Record<string, HTMLElement>>({});
  const overlaysRef = useRef<DomOverlayHandle[]>([]);

  useEffect(() => {
    if (!map) return;

    const created: DomOverlayHandle[] = [];
    const next: Record<string, HTMLElement> = {};

    for (const p of pins) {
      const overlay = createDomOverlay(map, { lng: p.lng, lat: p.lat }, "bottom");
      overlay.element.style.cursor = "pointer";
      created.push(overlay);
      next[p.id] = overlay.element;
    }

    overlaysRef.current = created;
    setContainers(next);

    return () => {
      overlaysRef.current.forEach((o) => o.remove());
      overlaysRef.current = [];
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

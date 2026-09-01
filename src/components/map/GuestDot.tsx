"use client";

// The guest's own position — a blue dot with a soft halo.
//
// Same portal-into-an-overlay trick as MapPins: the map owns the
// positioning (DomOverlay.ts — Google Maps' OverlayView), React owns the
// pixels. The halo is a fixed size rather than an accuracy circle: a true
// accuracy radius in a dense city is often 50m+, which draws a
// dinner-plate-sized blob over half the canal ring and reads as an error.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useMapInstance } from "./BaseMap";
import { createDomOverlay } from "./DomOverlay";

export interface GuestDotProps {
  position: { lng: number; lat: number } | null;
}

export default function GuestDot({ position }: GuestDotProps) {
  const map = useMapInstance();
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!map || !position) return;

    const overlay = createDomOverlay(map, position, "center");
    setContainer(overlay.element);

    return () => {
      overlay.remove();
      setContainer(null);
    };
    // Re-creates the overlay on every position tick rather than moving an
    // existing one — GuestDot updates at most once per GPS fix, nowhere
    // near often enough for that churn to matter, and it keeps this
    // component as simple as MapPins' equivalent effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, position?.lng, position?.lat]);

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

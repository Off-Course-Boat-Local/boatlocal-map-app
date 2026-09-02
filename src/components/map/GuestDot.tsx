"use client";

// The guest's own position — a blue dot with a soft halo, plus a heading
// cone once the device's compass is available (same source as
// GuestNavigationScreen's own direction arrow — useCompassHeading — but
// drawn straight onto the dot itself, the way Google Maps' own blue dot
// does, rather than as a separate widget off in a corner. Founder,
// 2026-09-02: "you said you would give the location dot an arrow... why
// am i not seeing that?" — the compass hook existed, it just was never
// actually wired into this component).
//
// The map never rotates (BaseMap.tsx: heading: 0, no tilt/rotate — the
// illustrated style is a flat printed page), so "up" on screen is always
// true north. That makes the cone's own rotation just the raw compass
// heading, no bearing math needed the way the nav screen's arrow needs
// (that one points at a specific destination, not just "which way am I
// facing").
//
// Same portal-into-an-overlay trick as MapPins: the map owns the
// positioning (DomOverlay.ts — Google Maps' OverlayView), React owns the
// pixels. The halo is a fixed size rather than an accuracy circle: a true
// accuracy radius in a dense city is often 50m+, which draws a
// dinner-plate-sized blob over half the canal ring and reads as an error.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useCompassHeading } from "@/hooks/useCompassHeading";
import { useMapInstance } from "./BaseMap";
import { createDomOverlay } from "./DomOverlay";

export interface GuestDotProps {
  position: { lng: number; lat: number } | null;
}

export default function GuestDot({ position }: GuestDotProps) {
  const map = useMapInstance();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const { heading } = useCompassHeading();

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
    // Sized to fit the heading cone, which reaches further out than the
    // halo — the halo/dot stay centred inside this via their own
    // absolute + translate(-50%,-50%), not inset-0, so this wrapper's
    // size can grow independently of them.
    <div className="relative h-16 w-16">
      {heading !== null && (
        <svg
          aria-hidden
          width={64}
          height={64}
          viewBox="0 0 64 64"
          className="absolute left-1/2 top-1/2"
          style={{
            transform: `translate(-50%, -50%) rotate(${heading}deg)`,
            transformOrigin: "32px 32px",
            transition: "transform 150ms linear",
          }}
        >
          {/* A soft "flashlight beam" pointing up (true north — the map
              itself never rotates, see this file's header comment), same
              visual language as Google Maps' own directional cone. Wide
              enough to read as a direction, not so wide it looks like a
              search radius. */}
          <path d="M32 6 L48 30 A 18 18 0 0 1 16 30 Z" fill="var(--brand-primary)" opacity="0.3" />
        </svg>
      )}
      <span
        className="absolute left-1/2 top-1/2 h-[46px] w-[46px] -translate-x-1/2 -translate-y-1/2 rounded-full"
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

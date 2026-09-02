"use client";

// The guest's own position — a blue dot with a soft halo, plus a heading
// cone once the device's compass is available (the way Google Maps' own
// blue dot does it).
//
// The map never rotates (BaseMap.tsx: heading 0, no tilt/rotate — the
// illustrated style is a flat printed page), so "up" on screen is always
// true north. That makes the cone's rotation just the compass heading,
// with no bearing math (unlike GuestNavigationScreen's arrow, which points
// at a specific destination rather than "which way am I facing").
//
// Same portal-into-an-overlay trick as MapPins: the map owns the
// positioning (DomOverlay.ts — Google Maps' OverlayView), React owns the
// pixels. The halo is a fixed size rather than a real accuracy circle: a
// true accuracy radius in a dense city is often 50m+, which draws a
// dinner-plate-sized blob over half the canal ring and reads as an error.
//
// TWO BUGS FIXED HERE, 2026-09-02 (founder: "the directional cone is still
// not working AND its also flickering"):
//
//  1. THE FLICKER. This used to tear down and rebuild the whole overlay on
//     every position tick — including setContainer(null), which unmounts
//     the React portal and every node in it. The old comment claimed
//     GuestDot "updates at most once per GPS fix, nowhere near often
//     enough for that churn to matter"; that was simply wrong.
//     watchPosition fires continuously while a guest walks, so the dot was
//     being destroyed and remounted over and over — visible as a flicker,
//     and it also restarted the cone's CSS rotation transition every time,
//     which is why the cone never appeared to settle. The overlay is now
//     created ONCE per map and merely moved (DomOverlay's own setPosition)
//     when the coordinates change.
//
//  2. THE SPIN. A raw compass heading wraps 359° -> 0°, and a CSS rotate
//     transition takes that literally: a one-degree turn animates as a
//     359-degree spin the wrong way round. useSmoothedHeading below
//     accumulates a CONTINUOUS angle (always taking the short way round)
//     and applies a small dead zone, so ordinary compass jitter doesn't
//     wobble the cone at all.

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useCompassHeading } from "@/hooks/useCompassHeading";
import { useMapInstance } from "./BaseMap";
import { createDomOverlay, type DomOverlayHandle } from "./DomOverlay";

/** Degrees of compass movement to ignore. Phone magnetometers jitter by a degree or two at rest; without this the cone visibly shivers while the guest stands still. */
const HEADING_DEADZONE_DEGREES = 2;

export interface GuestDotProps {
  position: { lng: number; lat: number } | null;
}

/**
 * Turns a raw 0–360 compass heading into a continuously-increasing angle
 * that CSS can rotate to without ever spinning the long way round — see
 * bug 2 in this file's header comment.
 */
function useSmoothedHeading(heading: number | null): number | null {
  const [displayAngle, setDisplayAngle] = useState<number | null>(null);
  const continuousRef = useRef<number | null>(null);

  useEffect(() => {
    if (heading === null) return;

    const previous = continuousRef.current;
    if (previous === null) {
      continuousRef.current = heading;
      setDisplayAngle(heading);
      return;
    }

    // Shortest signed turn from where we currently point to the new
    // heading, in (-180, 180] — so 359° -> 1° is +2, not -358.
    const delta = (((heading - (previous % 360)) % 360) + 540) % 360 - 180;
    if (Math.abs(delta) < HEADING_DEADZONE_DEGREES) return;

    const next = previous + delta;
    continuousRef.current = next;
    setDisplayAngle(next);
  }, [heading]);

  return displayAngle;
}

export default function GuestDot({ position }: GuestDotProps) {
  const map = useMapInstance();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<DomOverlayHandle | null>(null);
  const gradientId = useId();

  const { heading } = useCompassHeading();
  const angle = useSmoothedHeading(heading);

  const lng = position?.lng ?? null;
  const lat = position?.lat ?? null;
  /** Whether we have a fix at all — NOT the coordinates themselves. See the effect below. */
  const hasPosition = lng !== null && lat !== null;

  // Created once, never per position — see bug 1 in the header.
  //
  // Depends on `hasPosition` (a boolean) rather than the coordinates: the
  // map is usually ready BEFORE the first GPS fix arrives, so keying this
  // on `[map]` alone meant the effect ran once, bailed out on the null
  // position, and never re-ran when the fix landed — no dot at all. Keying
  // it on the boolean re-runs it exactly once more, when a position first
  // exists, and then never again as the guest moves.
  useEffect(() => {
    if (!map || lng === null || lat === null) return;

    const overlay = createDomOverlay(map, { lng, lat }, "center");
    overlayRef.current = overlay;
    setContainer(overlay.element);

    return () => {
      overlay.remove();
      overlayRef.current = null;
      setContainer(null);
    };
    // lng/lat are read here but deliberately not depended on — subsequent
    // moves go through the setPosition effect below instead of rebuilding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, hasPosition]);

  // Move the existing overlay instead of recreating it.
  useEffect(() => {
    if (lng === null || lat === null) return;
    overlayRef.current?.setPosition({ lng, lat });
  }, [lng, lat]);

  if (!container || lng === null || lat === null) return null;

  return createPortal(
    // Sized to fit the cone, which reaches further out than the dot. The
    // dot centres itself independently (translate -50%), so this wrapper
    // can grow without shifting the dot off its coordinate.
    <div className="relative" style={{ width: 80, height: 80 }}>
      {angle !== null && (
        <svg
          aria-hidden
          width={80}
          height={80}
          viewBox="0 0 80 80"
          className="absolute left-1/2 top-1/2"
          style={{
            transform: `translate(-50%, -50%) rotate(${angle}deg)`,
            transformOrigin: "50% 50%",
            // Long enough to glide rather than snap, short enough to still
            // feel live in the hand.
            transition: "transform 250ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <defs>
            {/* Strongest right at the dot and fading to nothing outward —
                Google Maps' own beam reads as light being cast in the
                direction you face, not as a shape with an edge. The
                previous flat-opacity pie slice had a hard outer arc, which
                is what made it look like a wedge stuck on the map
                (founder: "the design of the cone is horrible"). */}
            <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
              <stop offset="10%" stopColor="var(--brand-primary)" stopOpacity="0.75" />
              <stop offset="45%" stopColor="var(--brand-primary)" stopOpacity="0.34" />
              <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* ~80° beam from the centre, pointing up (true north — the map
              itself never rotates). Wide enough to read instantly as
              "facing this way", narrow enough to still indicate a
              direction rather than a general area. Reaches most of the way
              to the box edge; the gradient, not the geometry, is what ends
              it, so there's no visible outer rim. */}
          <path d="M40 40 L16 11 A38 38 0 0 1 64 11 Z" fill={`url(#${gradientId})`} />
        </svg>
      )}
      {/* The dot itself: solid brand fill, thick white ring, soft drop
          shadow — Google Maps' treatment, and the reason it stays legible
          on top of both pale land and dark water. Deliberately NO large
          translucent disc behind it (founder, 2026-09-02: "not the blue
          circle around the blue circle") — that ring reads as an accuracy
          radius, which is a claim this app can't honestly make: a real
          urban GPS accuracy circle is often 50m+ and would smear across
          half the canal ring. */}
      <span
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: 18,
          height: 18,
          transform: "translate(-50%, -50%)",
          background: "var(--brand-primary)",
          border: "3px solid #FFFFFF",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        }}
      />
    </div>,
    container,
  );
}

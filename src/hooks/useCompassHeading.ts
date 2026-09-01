"use client";

// Live device compass heading, degrees clockwise from north. Feeds the
// direction-to-walk arrow in GuestNavigationScreen — kept as its own hook
// (not folded into useGuestLocation) because it's an unrelated browser API
// with its own iOS permission gate, and most guest screens never need it.
//
// iOS Safari (13+) requires an explicit user gesture to grant orientation
// access — DeviceOrientationEvent.requestPermission() must be called from a
// tap handler, so this hook exposes permissionNeeded/requestPermission
// rather than requesting on mount. Every other browser fires the event with
// no permission step at all, so requestPermission is simply a no-op there.

import { useEffect, useState } from "react";

interface IOSDeviceOrientationEventStatic {
  requestPermission?: () => Promise<"granted" | "denied">;
}

interface CompassOrientationEvent extends DeviceOrientationEvent {
  /** Non-standard iOS Safari field — true compass heading, no inversion needed. */
  webkitCompassHeading?: number;
}

export interface UseCompassHeadingResult {
  /** Degrees clockwise from north, or null before a first reading arrives. */
  heading: number | null;
  /** True only on iOS Safari before the guest has granted orientation access. */
  permissionNeeded: boolean;
  /** Triggers the iOS permission prompt. Must be called from a tap handler. */
  requestPermission: () => void;
}

function iosOrientationStatic(): IOSDeviceOrientationEventStatic | undefined {
  if (typeof window === "undefined" || !window.DeviceOrientationEvent) return undefined;
  return window.DeviceOrientationEvent as unknown as IOSDeviceOrientationEventStatic;
}

function readHeading(event: CompassOrientationEvent): number | null {
  if (typeof event.webkitCompassHeading === "number") return event.webkitCompassHeading;
  if (event.absolute && typeof event.alpha === "number") return (360 - event.alpha) % 360;
  return null;
}

export function useCompassHeading(): UseCompassHeadingResult {
  const [heading, setHeading] = useState<number | null>(null);
  const [permissionNeeded, setPermissionNeeded] = useState(false);

  useEffect(() => {
    const handleOrientation = (event: Event) => {
      const next = readHeading(event as CompassOrientationEvent);
      if (next !== null) setHeading(next);
    };
    window.addEventListener("deviceorientationabsolute", handleOrientation);
    window.addEventListener("deviceorientation", handleOrientation);

    if (typeof iosOrientationStatic()?.requestPermission === "function") {
      setPermissionNeeded(true);
    }

    return () => {
      window.removeEventListener("deviceorientationabsolute", handleOrientation);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, []);

  const requestPermission = () => {
    iosOrientationStatic()
      ?.requestPermission?.()
      .then((result) => {
        if (result === "granted") setPermissionNeeded(false);
      })
      .catch(() => {});
  };

  return { heading, permissionNeeded, requestPermission };
}

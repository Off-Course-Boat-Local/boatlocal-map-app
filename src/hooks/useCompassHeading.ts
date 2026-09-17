"use client";

// Live device compass heading, degrees clockwise from north. Feeds the
// heading cone on the guest's own location dot (GuestDot) and the
// direction-to-walk arrow in GuestNavigationScreen.
//
// A MODULE-LEVEL SINGLETON, not per-component state — deliberately, and
// this is the fix for a real bug (founder, 2026-09-02: "the directional
// cone is still not working", after having granted the permission):
//
//  1. iOS ONLY DELIVERS TO LISTENERS ATTACHED AFTER THE GRANT.
//     DeviceOrientationEvent.requestPermission() resolving "granted" does
//     NOT retroactively wake up a `deviceorientation` listener that was
//     registered before it. The previous version of this hook attached its
//     listeners on mount and never re-attached, so on iOS the permission
//     could be granted and the events would still never arrive — the cone
//     simply never appeared, no matter how many times you tapped. Listeners
//     are now attached only once access is actually available: immediately
//     on non-iOS browsers (which have no gate), and inside the grant's own
//     .then() on iOS.
//
//  2. ONE GRANT HAS TO LIGHT UP EVERY CONSUMER. Two components use this
//     (GuestMapScreen, for the permission prompt, and GuestDot, for the
//     cone itself). With per-component state, granting via one left the
//     other's listener dead. A single shared store means the grant, and
//     every reading after it, reaches all of them at once.
//
//  3. EVENT RATE. deviceorientation fires up to ~60Hz. Feeding every one of
//     those into React state re-rendered GuestDot (and its portalled
//     overlay) 60x a second for sub-degree noise. Readings are now gated to
//     a minimum change and coalesced to one notification per animation
//     frame.

import { useCallback, useEffect, useSyncExternalStore } from "react";

interface IOSDeviceOrientationEventStatic {
  requestPermission?: () => Promise<"granted" | "denied">;
}

interface CompassOrientationEvent extends DeviceOrientationEvent {
  /** Non-standard iOS Safari field — a true compass heading, already clockwise-from-north. */
  webkitCompassHeading?: number;
}

export interface UseCompassHeadingResult {
  /** Degrees clockwise from north, or null before a first reading arrives. */
  heading: number | null;
  /** True only on iOS Safari, before the guest has granted orientation access. */
  permissionNeeded: boolean;
  /** Triggers the iOS permission prompt. MUST be called from a real tap handler. */
  requestPermission: () => void;
}

/** Ignore sub-degree magnetometer noise — see point 3 in the header. */
const MIN_CHANGE_DEGREES = 1;

interface Snapshot {
  heading: number | null;
  permissionNeeded: boolean;
}

const SERVER_SNAPSHOT: Snapshot = { heading: null, permissionNeeded: false };

let snapshot: Snapshot = SERVER_SNAPSHOT;
let rawHeading: number | null = null;
let listenersAttached = false;
let initialised = false;
let frame: number | null = null;

const subscribers = new Set<() => void>();

function publish() {
  frame = null;
  snapshot = { heading: rawHeading, permissionNeeded: snapshot.permissionNeeded };
  subscribers.forEach((notify) => notify());
}

/** Coalesces a burst of orientation events into one notification per frame. */
function schedulePublish() {
  if (frame !== null) return;
  frame = requestAnimationFrame(publish);
}

function setPermissionNeeded(next: boolean) {
  if (snapshot.permissionNeeded === next) return;
  snapshot = { heading: snapshot.heading, permissionNeeded: next };
  subscribers.forEach((notify) => notify());
}

function iosOrientationStatic(): IOSDeviceOrientationEventStatic | undefined {
  if (typeof window === "undefined" || !window.DeviceOrientationEvent) return undefined;
  return window.DeviceOrientationEvent as unknown as IOSDeviceOrientationEventStatic;
}

/**
 * Tilt-compensated compass heading from the three raw Euler angles, for
 * browsers with no `webkitCompassHeading` (i.e. everyone but iOS Safari).
 *
 * PLAIN `360 - alpha` (this function's predecessor) IS ONLY A COMPASS
 * HEADING WHEN THE DEVICE IS LYING FLAT. `alpha` is rotation around the
 * device's own z-axis, and that axis only points straight up at the sky
 * (matching "which way is the top of the phone facing, seen from above")
 * when the phone is flat on a table. This feature exists for someone
 * WALKING with the phone held upright in front of them — the one posture
 * where that assumption is furthest from true — so the naive conversion
 * reported a heading that drifted or inverted with how far back the phone
 * was tilted, which reads exactly as "the arrow points the wrong way when I
 * turn": walking normally, not turning the phone's face towards the sky.
 * This combines all three angles (the standard fused-orientation formula —
 * see e.g. w3c's DeviceOrientation examples) so tilt cancels out and the
 * result matches a real compass regardless of how the phone is held.
 */
function tiltCompensatedHeading(alphaDeg: number, betaDeg: number, gammaDeg: number): number {
  // If the device is lying flat, Euler tilt-compensation components rA and rB
  // collapse towards 0, causing atan2(0, 0) = 0 (locking compass to north).
  // In this flat plane, the true-north heading is simply (360 - alpha) % 360.
  if (Math.abs(betaDeg) < 5 && Math.abs(gammaDeg) < 5) {
    return (360 - alphaDeg) % 360;
  }

  const alpha = (alphaDeg * Math.PI) / 180;
  const beta = (betaDeg * Math.PI) / 180;
  const gamma = (gammaDeg * Math.PI) / 180;

  const cA = Math.cos(alpha);
  const sA = Math.sin(alpha);
  const sB = Math.sin(beta);
  const cG = Math.cos(gamma);
  const sG = Math.sin(gamma);

  // Components of the compass-pointing (world -y) axis, expressed in the
  // device's own frame after undoing its alpha/beta/gamma rotation.
  const rA = -cA * sG - sA * sB * cG;
  const rB = -sA * sG + cA * sB * cG;

  if (Math.abs(rA) < 1e-6 && Math.abs(rB) < 1e-6) {
    return (360 - alphaDeg) % 360;
  }

  let heading = Math.atan2(rA, rB);
  if (heading < 0) heading += 2 * Math.PI;

  return (heading * 180) / Math.PI;
}

function readHeading(event: CompassOrientationEvent): number | null {
  // iOS's own field is a real, already tilt-compensated compass heading and
  // needs no conversion.
  const webkitHeading = event.webkitCompassHeading;
  if (typeof webkitHeading === "number" && Number.isFinite(webkitHeading)) {
    return webkitHeading;
  }
  // Everyone else: only trusted when `absolute` — a relative reading points
  // nowhere real — and only once beta/gamma (the device's tilt) are known,
  // since alpha alone is meaningless once the phone isn't lying flat.
  if (
    event.absolute &&
    typeof event.alpha === "number" &&
    Number.isFinite(event.alpha) &&
    typeof event.beta === "number" &&
    Number.isFinite(event.beta) &&
    typeof event.gamma === "number" &&
    Number.isFinite(event.gamma)
  ) {
    return tiltCompensatedHeading(event.alpha, event.beta, event.gamma);
  }
  return null;
}

function handleOrientation(event: Event) {
  const next = readHeading(event as CompassOrientationEvent);
  if (next === null) return;
  if (rawHeading !== null) {
    // Compare the short way round so 359° -> 1° counts as a 2° change,
    // not 358°.
    const delta = Math.abs((((next - rawHeading) % 360) + 540) % 360 - 180);
    if (delta < MIN_CHANGE_DEGREES) return;
  }
  rawHeading = next;
  schedulePublish();
}

/** Attaches the window listeners. Safe to call repeatedly — only the first call binds. */
function attachListeners() {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  // `deviceorientationabsolute` is the one that carries a true-north
  // reading on Android/Chrome; iOS doesn't fire it at all and uses
  // webkitCompassHeading on the plain event instead. Listening to both,
  // and letting readHeading decide which is trustworthy, covers both.
  window.addEventListener("deviceorientationabsolute", handleOrientation);
  window.addEventListener("deviceorientation", handleOrientation);
}

function initialise() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;

  if (typeof iosOrientationStatic()?.requestPermission === "function") {
    // iOS: do NOT attach yet — a listener bound before the grant never
    // receives anything (see point 1 in the header). Wait for the tap.
    setPermissionNeeded(true);
    return;
  }
  attachListeners();
}

function requestPermissionImpl() {
  const api = iosOrientationStatic();
  if (typeof api?.requestPermission !== "function") {
    // Not iOS — nothing to ask for, just make sure we're listening.
    attachListeners();
    return;
  }
  void api
    .requestPermission()
    .then((result) => {
      if (result !== "granted") return;
      setPermissionNeeded(false);
      // The whole point: attach only now that access exists.
      attachListeners();
    })
    .catch(() => {
      // Denied, or called outside a user gesture. Leaving permissionNeeded
      // as-is keeps the prompt available for another try.
    });
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

export function useCompassHeading(): UseCompassHeadingResult {
  useEffect(() => {
    initialise();
  }, []);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const requestPermission = useCallback(() => requestPermissionImpl(), []);

  return {
    heading: state.heading,
    permissionNeeded: state.permissionNeeded,
    requestPermission,
  };
}

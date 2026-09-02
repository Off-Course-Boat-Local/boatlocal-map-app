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

function readHeading(event: CompassOrientationEvent): number | null {
  // iOS's own field is a real compass heading and needs no conversion.
  const webkitHeading = event.webkitCompassHeading;
  if (typeof webkitHeading === "number" && Number.isFinite(webkitHeading)) {
    return webkitHeading;
  }
  // Everyone else: alpha is counter-clockwise from north, hence 360 - alpha.
  // Only trusted when `absolute` — a relative reading points nowhere real.
  if (event.absolute && typeof event.alpha === "number" && Number.isFinite(event.alpha)) {
    return (360 - event.alpha) % 360;
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

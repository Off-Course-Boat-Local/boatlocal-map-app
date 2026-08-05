"use client";

// Live guest position, as a state machine.
//
// The four states in LocationState are all real and all common:
//  - loading      first fix pending, or the OS prompt is on screen
//  - granted      we have a position (and an accuracy radius worth drawing)
//  - denied       the guest said no — recoverable only via browser settings
//  - unavailable  no Geolocation API, insecure origin, or the fix failed
//
// The UI must look finished in every one of them. See the spike page at
// /spike/location for the no-location card.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FALLBACK_GUEST_POSITION } from "@/lib/data";
import type { LocationState } from "@/lib/types";

/**
 * Why we could not get a position. LocationState only has one "unavailable"
 * arm, but the copy we show differs a lot between "your browser can't do this"
 * and "we couldn't get a fix, try again" — so the detail is surfaced here
 * rather than by widening the shared type.
 */
export type LocationFailureReason =
  | "unsupported"
  | "insecure-context"
  | "permission-denied"
  | "position-unavailable"
  | "timeout";

export interface UseGuestLocationOptions {
  /**
   * Development escape hatch: skip the browser API entirely and report a fixed
   * position. The spike runs on desktop, where real geolocation is either
   * missing or wrong by a kilometre.
   */
  simulate?: boolean;
  /** Position used when `simulate` is on. Defaults to FALLBACK_GUEST_POSITION. */
  simulatedPosition?: { lng: number; lat: number };
  /** Accuracy radius reported when `simulate` is on, in metres. */
  simulatedAccuracy?: number;
  /**
   * Set false to hold off asking. Useful if you want the map to render before
   * the OS permission sheet appears over it.
   */
  enabled?: boolean;
  /** Passed straight to watchPosition. Defaults true — we need street-level. */
  enableHighAccuracy?: boolean;
  /** Give up on a single fix after this long. */
  timeoutMs?: number;
  /** Accept a cached fix this old. Keeps the first paint fast. */
  maximumAgeMs?: number;
}

export interface UseGuestLocationResult {
  /** The state to render. */
  location: LocationState;
  /** Detail behind a `denied`/`unavailable` state, or null. */
  reason: LocationFailureReason | null;
  /** True when the position is simulated rather than real. */
  isSimulated: boolean;
  /**
   * Re-request the position. Resets to `loading` and restarts the watch, so a
   * "denied" panel can offer a retry button. Note that once a browser has a
   * hard permission denial recorded this will fail again immediately — that is
   * the browser's decision, not a bug, which is why the denied UI also has to
   * work as a permanent state.
   */
  request: () => void;
}

const DEFAULTS = {
  enableHighAccuracy: true,
  timeoutMs: 10_000,
  maximumAgeMs: 15_000,
};

type GeoSupport = "ok" | "unsupported" | "insecure-context";

const noopSubscribe = () => () => {};

/**
 * Whether the Geolocation API is usable at all. This is environment, not
 * state: it is read during render via useSyncExternalStore rather than pushed
 * into state from an effect, so there is no "loading" flash on a browser that
 * was never going to answer.
 */
function readGeoSupport(): GeoSupport {
  // Truthiness, not `"geolocation" in navigator`. The key can be present with
  // an undefined value — some embedded webviews and privacy browsers stub it
  // out that way — and an `in` check happily reports "supported" right before
  // we crash on `navigator.geolocation.watchPosition`.
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return "unsupported";
  }
  // Present but guaranteed to fail: the page is not in a secure context.
  //
  // Tested by protocol rather than by `isSecureContext === false`, because
  // that check silently passes when the property is undefined — and then we
  // call watchPosition on an origin the browser will never answer for, and
  // sit on "loading" forever. Localhost is exempt per the spec, which is why
  // this never reproduces on a dev machine and always reproduces on a phone
  // pointed at a LAN IP.
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const localhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]";
    if (protocol !== "https:" && !localhost) return "insecure-context";
    if (window.isSecureContext === false) return "insecure-context";
  }
  return "ok";
}

/** Server render assumes support and lets the client correct it. */
const serverGeoSupport = (): GeoSupport => "ok";

export function useGuestLocation(
  options: UseGuestLocationOptions = {},
): UseGuestLocationResult {
  const {
    simulate = false,
    simulatedPosition = FALLBACK_GUEST_POSITION,
    simulatedAccuracy = 25,
    enabled = true,
    enableHighAccuracy = DEFAULTS.enableHighAccuracy,
    timeoutMs = DEFAULTS.timeoutMs,
    maximumAgeMs = DEFAULTS.maximumAgeMs,
  } = options;

  const support = useSyncExternalStore(
    noopSubscribe,
    readGeoSupport,
    serverGeoSupport,
  );

  const [watched, setWatched] = useState<LocationState>({ status: "loading" });
  const [watchReason, setWatchReason] = useState<LocationFailureReason | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);

  // Once we have a fix, a later POSITION_UNAVAILABLE/TIMEOUT is usually just
  // the guest walking under a bridge. Dropping the blue dot for that would be
  // worse than showing a slightly stale one.
  const hasFixRef = useRef(false);

  const simLng = simulatedPosition.lng;
  const simLat = simulatedPosition.lat;

  const request = useCallback(() => {
    hasFixRef.current = false;
    setWatchReason(null);
    setWatched({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const shouldWatch = enabled && !simulate && support === "ok";

  useEffect(() => {
    if (!shouldWatch) return;

    let cancelled = false;
    let watchId: number | null = null;

    const onSuccess = (pos: GeolocationPosition) => {
      if (cancelled) return;
      clearTimeout(watchdog);
      hasFixRef.current = true;
      setWatchReason(null);
      setWatched({
        status: "granted",
        lng: pos.coords.longitude,
        lat: pos.coords.latitude,
        accuracy: pos.coords.accuracy,
      });
    };

    const onError = (err: GeolocationPositionError) => {
      if (cancelled) return;
      clearTimeout(watchdog);

      if (err.code === err.PERMISSION_DENIED) {
        hasFixRef.current = false;
        setWatchReason("permission-denied");
        setWatched({ status: "denied" });
        // A denial is final for this page load; stop burning battery.
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }
        return;
      }

      // Transient failure after we already had a fix: keep the dot rather than
      // blinking the whole location layer out of existence.
      if (hasFixRef.current) return;

      setWatchReason(err.code === err.TIMEOUT ? "timeout" : "position-unavailable");
      setWatched({ status: "unavailable" });
    };

    hasFixRef.current = false;

    // Watchdog. `watchPosition` is not guaranteed to call back at all: if the
    // guest simply ignores the permission sheet, neither the success nor the
    // error callback ever fires, and the documented `timeout` option does not
    // cover that case. Without this the UI sits on "Finding you…" for the rest
    // of the session — which reads as a broken app rather than as a choice the
    // guest made.
    const watchdog = setTimeout(() => {
      if (cancelled || hasFixRef.current) return;
      setWatchReason("timeout");
      setWatched({ status: "unavailable" });
    }, timeoutMs + 2000);

    watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy,
      timeout: timeoutMs,
      maximumAge: maximumAgeMs,
    });

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      // Optional-chained on purpose. This cleanup runs asynchronously, after
      // the component is gone, and it must not be the thing that throws
      // during an unmount or a page teardown — at which point there is no
      // error boundary left to catch it.
      if (watchId !== null) navigator.geolocation?.clearWatch(watchId);
    };
    // `attempt` is the retry trigger. Note we deliberately do NOT reset state
    // to "loading" here on an options change — request() already does that,
    // and re-running for, say, a timeout tweak should not flicker a good fix.
  }, [attempt, shouldWatch, enableHighAccuracy, timeoutMs, maximumAgeMs]);

  if (simulate) {
    return {
      location: {
        status: "granted",
        lng: simLng,
        lat: simLat,
        accuracy: simulatedAccuracy,
      },
      reason: null,
      isSimulated: true,
      request,
    };
  }

  if (support !== "ok") {
    return {
      location: { status: "unavailable" },
      reason: support,
      isSimulated: false,
      request,
    };
  }

  return {
    location: watched,
    reason: watchReason,
    isSimulated: false,
    request,
  };
}

/**
 * Narrowing helper so callers can go straight from a LocationState to
 * something `formatWalk` / `DirectionLine` accept.
 */
export function guestPoint(
  state: LocationState,
): { lng: number; lat: number } | null {
  return state.status === "granted" ? { lng: state.lng, lat: state.lat } : null;
}

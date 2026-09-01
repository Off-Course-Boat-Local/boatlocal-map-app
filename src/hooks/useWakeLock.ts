"use client";

// Keeps the screen awake while `active` is true. Used by
// GuestNavigationScreen: a guest walking a 20-minute route glances at their
// phone every block or so, and the default screen timeout means every one of
// those glances starts with unlocking the phone and finding the app again.
//
// Screen Wake Lock is best-effort by design — Safari on iOS only shipped it
// in 16.4, and the browser drops the lock whenever the tab is backgrounded
// (that's the spec, not a bug). Hence the visibilitychange re-acquire, and
// hence every failure path here is a silent no-op: a guest whose browser
// refuses the lock still gets a perfectly working navigation screen, just
// with their normal screen timeout.

import { useEffect } from "react";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  released: boolean;
}

interface WakeLockLike {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
}

function wakeLockApi(): WakeLockLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
}

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const api = wakeLockApi();
    if (!api) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = () => {
      // Requesting while hidden always rejects — skip rather than churn.
      if (document.visibilityState !== "visible") return;
      void api
        .request("screen")
        .then((next) => {
          if (cancelled) {
            void next.release().catch(() => {});
            return;
          }
          sentinel = next;
        })
        .catch(() => {});
    };

    // The browser silently releases the lock when the tab is backgrounded,
    // so coming back to the app has to take it again.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && (!sentinel || sentinel.released)) {
        acquire();
      }
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => {});
    };
  }, [active]);
}

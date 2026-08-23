"use client";

// Shared by InstallScreen (to show "you're already installed" instead of
// install steps) and GuestWelcomeScreen's install-nudge banner (which must
// not tell an already-installed guest to add the app to their home screen
// a second time).
//
// `display-mode: standalone` is the cross-browser signal once installed;
// `navigator.standalone` is Safari's older, iOS-only equivalent, kept as a
// fallback for iOS versions/contexts where the media query alone is
// unreliable.
//
// useSyncExternalStore, not an effect + setState — see useIsDesktopPointer's
// header comment for why (same SSR/hydration reasoning applies here).

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

function getSnapshot(): boolean {
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true || iosStandalone === true
  );
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsStandalone(): boolean {
  return useSyncExternalStore(noopSubscribe, getSnapshot, getServerSnapshot);
}

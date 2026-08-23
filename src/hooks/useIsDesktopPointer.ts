"use client";

// Shared by GuestWelcomeScreen's install-nudge banner and InstallScreen's
// "scan this QR code" fallback — both need the same true/false answer to
// "is the primary input a mouse/trackpad", extracted here after the nudge
// banner shipped without this check and kept showing "Add this to your
// home screen" on a plain desktop browser tab, where there is no home
// screen to add it to.
//
// Deliberately `(hover: hover) and (pointer: fine)`, NOT UA sniffing
// (unlike src/lib/installPlatform.ts's iOS/Android split, which has no
// feature-detection substitute) — this is exactly the media query built for
// "can the primary input hover and is it precise", true for a mouse, false
// for anything touch-primary. That is the real desktop/phone line both
// call sites need, not a three-way UA guess.
//
// useSyncExternalStore (not an effect + setState) keeps SSR/hydration
// consistent: the server snapshot is always `false` (no window), and the
// client's first real render already has the correct answer, so there is
// no flash of the wrong state and no hydration-mismatch warning.

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

function getSnapshot(): boolean {
  return window.matchMedia?.("(hover: hover) and (pointer: fine)").matches === true;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsDesktopPointer(): boolean {
  return useSyncExternalStore(noopSubscribe, getSnapshot, getServerSnapshot);
}

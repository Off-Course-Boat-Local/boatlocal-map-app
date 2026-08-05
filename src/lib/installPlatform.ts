// Pure User-Agent classification for the Install screen
// (src/components/guest/InstallScreen.tsx).
//
// UA sniffing is normally the wrong tool, but there is no reliable
// feature-detection substitute for "is this iOS" — Safari (and every other
// iOS browser, since they all wrap WebKit) never fires
// `beforeinstallprompt`, so the guest needs different, manual words on iOS
// than on Android, where a native one-tap prompt is usually available. This
// is a UX hint, not a security or permission decision, so UA sniffing is an
// accepted trade-off here (see the task notes for this build).
//
// Kept as a pure function of a UA string (+ optional touch-point count) so
// it can be unit tested without a browser, and so InstallScreen.tsx's
// `useEffect` is a one-line call rather than inline regex.

import type { EventPlatform } from "./data/types";

export type InstallPlatform = "ios" | "android" | "other";

/**
 * Classifies a device from its User-Agent string.
 *
 * iPadOS 13+ requests desktop sites by default and reports as "Macintosh"
 * with no "iPad" token at all — the only remaining signal is that it (unlike
 * a real Mac) has touch points, hence the optional `maxTouchPoints` param
 * (pass `navigator.maxTouchPoints`; omitted/0 just skips that check, which
 * is exactly right for a UA string with no device attached, e.g. in tests).
 */
export function detectInstallPlatform(
  userAgent: string,
  maxTouchPoints = 0,
): InstallPlatform {
  const ua = userAgent.toLowerCase();

  const isIOSDevice = /iphone|ipad|ipod/.test(ua);
  const isIPadOsDesktopMode = /macintosh/.test(ua) && maxTouchPoints > 1;
  if (isIOSDevice || isIPadOsDesktopMode) return "ios";

  if (/android/.test(ua)) return "android";

  return "other";
}

/**
 * Maps to the `events.platform` column (src/lib/data/types.ts) for analytics
 * — "other" becomes "unknown" rather than "desktop" because a UA we didn't
 * recognise as iOS/Android is not necessarily a desktop (it could be an
 * unusual mobile browser), and an analytics platform column should not
 * assert more than the detection actually knows.
 */
export function installPlatformToEventPlatform(
  platform: InstallPlatform,
): EventPlatform {
  if (platform === "ios") return "ios";
  if (platform === "android") return "android";
  return "unknown";
}

import { describe, expect, it } from "vitest";

import { detectInstallPlatform, installPlatformToEventPlatform } from "./installPlatform";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.79 Mobile/15E148 Safari/604.1";

const IPAD_SAFARI_MOBILE_UA =
  "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

const IPAD_DESKTOP_MODE_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

const REAL_MAC_SAFARI = IPAD_DESKTOP_MODE_UA; // identical UA string by design — only maxTouchPoints tells them apart

const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

const ANDROID_FIREFOX =
  "Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0";

const DESKTOP_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

describe("detectInstallPlatform", () => {
  it("recognises an iPhone regardless of which browser is rendering it", () => {
    expect(detectInstallPlatform(IPHONE_SAFARI)).toBe("ios");
    expect(detectInstallPlatform(IPHONE_CHROME)).toBe("ios");
  });

  it("recognises an iPad in mobile UA mode", () => {
    expect(detectInstallPlatform(IPAD_SAFARI_MOBILE_UA)).toBe("ios");
  });

  it("recognises an iPad requesting the desktop site via its touch-point count", () => {
    expect(detectInstallPlatform(IPAD_DESKTOP_MODE_UA, 5)).toBe("ios");
  });

  it("does not misclassify a real Mac (no touch points) as iOS", () => {
    expect(detectInstallPlatform(REAL_MAC_SAFARI, 0)).toBe("other");
  });

  it("recognises Android", () => {
    expect(detectInstallPlatform(ANDROID_CHROME)).toBe("android");
    expect(detectInstallPlatform(ANDROID_FIREFOX)).toBe("android");
  });

  it("falls back to 'other' for desktop browsers", () => {
    expect(detectInstallPlatform(DESKTOP_CHROME)).toBe("other");
  });

  it("falls back to 'other' for an empty/unknown UA rather than throwing", () => {
    expect(detectInstallPlatform("")).toBe("other");
  });
});

describe("installPlatformToEventPlatform", () => {
  it("maps ios/android straight through", () => {
    expect(installPlatformToEventPlatform("ios")).toBe("ios");
    expect(installPlatformToEventPlatform("android")).toBe("android");
  });

  it("maps 'other' to 'unknown', not 'desktop' — detection doesn't know that much", () => {
    expect(installPlatformToEventPlatform("other")).toBe("unknown");
  });
});

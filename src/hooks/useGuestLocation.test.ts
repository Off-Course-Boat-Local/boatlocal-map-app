import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { guestPoint, useGuestLocation } from "./useGuestLocation";
import { FALLBACK_GUEST_POSITION } from "@/lib/data";

const originalGeolocation = navigator.geolocation;

/**
 * Real GeolocationPositionError instances carry PERMISSION_DENIED /
 * POSITION_UNAVAILABLE / TIMEOUT as instance properties, and the hook compares
 * against them. A bare `{ code: 1 }` literal is not a faithful stand-in.
 */
function geoError(code: 1 | 2 | 3, message: string): GeolocationPositionError {
  return {
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

const originalLocation = window.location;

/** jsdom lets `location` be redefined; readGeoSupport only reads protocol+hostname. */
function setOrigin(href: string) {
  Object.defineProperty(window, "location", {
    value: new URL(href),
    configurable: true,
  });
}

function installGeolocation(impl: Partial<Geolocation>) {
  Object.defineProperty(navigator, "geolocation", {
    value: { watchPosition: vi.fn(), clearWatch: vi.fn(), ...impl },
    configurable: true,
  });
}

function removeGeolocation() {
  Object.defineProperty(navigator, "geolocation", {
    value: undefined,
    configurable: true,
  });
}

afterEach(() => {
  Object.defineProperty(navigator, "geolocation", {
    value: originalGeolocation,
    configurable: true,
  });
  Object.defineProperty(window, "location", {
    value: originalLocation,
    configurable: true,
  });
});

describe("useGuestLocation", () => {
  it("reports a granted position when the browser provides one", async () => {
    installGeolocation({
      watchPosition: ((success: PositionCallback) => {
        success({
          coords: { latitude: 52.3731, longitude: 4.8936, accuracy: 22 },
          timestamp: 0,
        } as GeolocationPosition);
        return 1;
      }) as Geolocation["watchPosition"],
    });

    const { result } = renderHook(() => useGuestLocation());

    await waitFor(() => expect(result.current.location.status).toBe("granted"));
    if (result.current.location.status === "granted") {
      expect(result.current.location.lat).toBeCloseTo(52.3731, 4);
      expect(result.current.location.accuracy).toBe(22);
    }
  });

  it("distinguishes a permission denial from other failures", async () => {
    installGeolocation({
      watchPosition: ((
        _success: PositionCallback,
        error: PositionErrorCallback,
      ) => {
        error(geoError(1, "denied"));
        return 1;
      }) as Geolocation["watchPosition"],
    });

    const { result } = renderHook(() => useGuestLocation());

    await waitFor(() => expect(result.current.location.status).toBe("denied"));
    expect(result.current.reason).toBe("permission-denied");
  });

  it("treats an unavailable position as recoverable, not denied", async () => {
    // A guest indoors with no fix is a different situation from one who said
    // no. The first deserves a retry button; the second must not be nagged.
    installGeolocation({
      watchPosition: ((
        _success: PositionCallback,
        error: PositionErrorCallback,
      ) => {
        error(geoError(2, "unavailable"));
        return 1;
      }) as Geolocation["watchPosition"],
    });

    const { result } = renderHook(() => useGuestLocation());

    await waitFor(() =>
      expect(result.current.location.status).toBe("unavailable"),
    );
    expect(result.current.reason).toBe("position-unavailable");
  });

  it("reports unavailable rather than crashing when the API is absent", async () => {
    removeGeolocation();
    const { result } = renderHook(() => useGuestLocation());
    await waitFor(() =>
      expect(result.current.location.status).toBe("unavailable"),
    );
  });

  it("never sits on 'loading' over plain http", async () => {
    // Found on a real phone pointed at a LAN IP. `isSecureContext` was not
    // literally false, so we called watchPosition on an origin the browser
    // will never answer for and the UI showed "Finding you…" forever. It has
    // to resolve to a finished state — the guest is not waiting for anything.
    //
    // jsdom defaults to http://localhost, which IS a secure context per spec,
    // so the origin has to be overridden or this bug cannot reproduce.
    setOrigin("http://192.168.1.183:3000/spike/guest");
    const watchPosition = vi.fn();
    installGeolocation({
      watchPosition: watchPosition as unknown as Geolocation["watchPosition"],
    });

    const { result } = renderHook(() => useGuestLocation());

    await waitFor(() =>
      expect(result.current.location.status).toBe("unavailable"),
    );
    expect(result.current.reason).toBe("insecure-context");
    expect(watchPosition).not.toHaveBeenCalled();
  });

  it("still works over plain http on localhost", async () => {
    // The flip side: dev on localhost must not be broken by the check above.
    setOrigin("http://localhost:3000/spike/guest");
    installGeolocation({
      watchPosition: ((success: PositionCallback) => {
        success({
          coords: { latitude: 52.3731, longitude: 4.8936, accuracy: 12 },
          timestamp: 0,
        } as GeolocationPosition);
        return 1;
      }) as Geolocation["watchPosition"],
    });

    const { result } = renderHook(() => useGuestLocation());
    await waitFor(() => expect(result.current.location.status).toBe("granted"));
  });

  it("gives up rather than hanging when watchPosition never calls back", async () => {
    // A guest who ignores the OS permission sheet produces no success AND no
    // error callback, and the spec's `timeout` option does not cover that
    // case. Without our own watchdog the app looks broken rather than
    // un-permitted.
    setOrigin("https://guide.example.test/spike/guest");
    installGeolocation({
      watchPosition: (() => 7) as Geolocation["watchPosition"],
    });

    const { result } = renderHook(() => useGuestLocation({ timeoutMs: 10 }));
    expect(result.current.location.status).toBe("loading");

    await waitFor(
      () => expect(result.current.location.status).toBe("unavailable"),
      { timeout: 5_000 },
    );
    expect(result.current.reason).toBe("timeout");
  });

  it("stops watching on unmount", async () => {
    const clearWatch = vi.fn();
    installGeolocation({
      watchPosition: (() => 42) as Geolocation["watchPosition"],
      clearWatch,
    });

    const { unmount } = renderHook(() => useGuestLocation());
    await waitFor(() => expect(clearWatch).toHaveBeenCalledTimes(0));
    unmount();
    expect(clearWatch).toHaveBeenCalledWith(42);
  });

  it("returns the simulated position without touching the browser API", async () => {
    const watchPosition = vi.fn();
    installGeolocation({
      watchPosition: watchPosition as unknown as Geolocation["watchPosition"],
    });

    const { result } = renderHook(() => useGuestLocation({ simulate: true }));

    await waitFor(() => expect(result.current.location.status).toBe("granted"));
    expect(result.current.isSimulated).toBe(true);
    expect(watchPosition).not.toHaveBeenCalled();
    if (result.current.location.status === "granted") {
      expect(result.current.location.lng).toBeCloseTo(
        FALLBACK_GUEST_POSITION.lng,
        4,
      );
    }
  });
});

describe("guestPoint", () => {
  it("returns coordinates only for a granted position", () => {
    expect(guestPoint({ status: "loading" })).toBeNull();
    expect(guestPoint({ status: "denied" })).toBeNull();
    expect(guestPoint({ status: "unavailable" })).toBeNull();
    expect(
      guestPoint({ status: "granted", lng: 4.89, lat: 52.37, accuracy: 10 }),
    ).toEqual({ lng: 4.89, lat: 52.37 });
  });
});

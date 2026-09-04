// The guest routing endpoint's own guards — the ones standing between an
// anonymous caller and a billed Google API call.
//
// Both route modules are mocked, so the real `server-only` imports never
// evaluate and no request ever leaves the machine. What's under test here is
// purely this handler's decisions: which mode (and therefore which BILLING
// TIER) fires, what reaches Google's request body, and what gets rejected
// before any of that happens.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { getWalkingRoute, getTransitRoute } = vi.hoisted(() => ({
  getWalkingRoute: vi.fn(),
  getTransitRoute: vi.fn(),
}));

vi.mock("@/lib/walkingRoute", () => ({ getWalkingRoute }));
vi.mock("@/lib/transitRoute", () => ({ getTransitRoute }));

const { GET } = await import("./route");

const ROUTE = { distanceMeters: 100, durationSeconds: 60, path: [], steps: [{}] };

/** Unique coordinates per call so the handler's own response cache never masks what we're asserting. */
let seq = 0;
function url(params: Record<string, string> = {}): string {
  seq += 1;
  const search = new URLSearchParams({
    originLng: String(4.8 + seq / 10_000),
    originLat: String(52.3 + seq / 10_000),
    destLng: "4.8996",
    destLat: "52.3703",
    ...params,
  });
  return `http://localhost/api/guest/walking-route?${search.toString()}`;
}

function request(target: string): NextRequest {
  return new Request(target) as unknown as NextRequest;
}

beforeEach(() => {
  getWalkingRoute.mockReset().mockResolvedValue(ROUTE);
  getTransitRoute.mockReset().mockResolvedValue(ROUTE);
});

describe("guest routing endpoint — mode selection", () => {
  it("routes ?mode=transit to the transit lookup, and only that one", async () => {
    const res = await GET(request(url({ mode: "transit" })));

    expect(res.status).toBe(200);
    expect(getTransitRoute).toHaveBeenCalledTimes(1);
    expect(getWalkingRoute).not.toHaveBeenCalled();
  });

  // THE LOAD-BEARING TEST. Transit bills on a higher Routes API tier than
  // walking, so "anything that isn't literally transit walks" must stay an
  // exact-equality check. A plausible future tidy-up to
  // `mode !== "walk" ? transit : walking` would silently make the expensive
  // tier the default for every malformed or stale-client call — including
  // DirectionLine's, which fires on every pin selection.
  it.each([
    ["no mode param", {}],
    ["mode=walk", { mode: "walk" }],
    ["mode=TRANSIT (wrong case)", { mode: "TRANSIT" }],
    ["mode=bogus", { mode: "bogus" }],
    ["mode empty", { mode: "" }],
  ])("takes the cheaper walking path for %s", async (_label, params) => {
    await GET(request(url(params)));

    expect(getWalkingRoute).toHaveBeenCalledTimes(1);
    expect(getTransitRoute).not.toHaveBeenCalled();
  });
});

describe("guest routing endpoint — language passthrough", () => {
  it("forwards a supported locale to the route lookup", async () => {
    await GET(request(url({ lang: "nl" })));

    expect(getWalkingRoute).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ languageCode: "nl" }),
    );
  });

  it.each(["it", "EN", "en-GB", "../../etc", ""])(
    "drops an unsupported lang value (%s) rather than passing it to Google",
    async (lang) => {
      await GET(request(url({ lang })));

      expect(getWalkingRoute).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ languageCode: undefined }),
      );
    },
  );
});

describe("guest routing endpoint — input rejection before a billed call", () => {
  it.each([
    ["a missing coordinate", "originLng"],
    ["an out-of-range latitude", "lat-range"],
    ["an out-of-range longitude", "lng-range"],
    ["empty strings", "empty"],
    ["a non-numeric value", "nan"],
  ])("400s on %s without calling either lookup", async (_label, kind) => {
    const base = new URLSearchParams({
      originLng: "4.8375",
      originLat: "52.3889",
      destLng: "4.8996",
      destLat: "52.3703",
      mode: "transit",
    });
    if (kind === "originLng") base.delete("originLng");
    if (kind === "lat-range") base.set("originLat", "99999");
    if (kind === "lng-range") base.set("destLng", "-1e300");
    if (kind === "empty") {
      // Number("") is 0, so these used to sail through as a valid (0,0) route.
      base.set("originLat", "");
      base.set("originLng", "");
    }
    if (kind === "nan") base.set("destLat", "north");

    const res = await GET(request(`http://localhost/api/guest/walking-route?${base.toString()}`));

    expect(res.status).toBe(400);
    expect(getWalkingRoute).not.toHaveBeenCalled();
    expect(getTransitRoute).not.toHaveBeenCalled();
  });
});

describe("guest routing endpoint — upstream failure", () => {
  it("502s with the mode when no route comes back", async () => {
    getTransitRoute.mockResolvedValue(null);

    const res = await GET(request(url({ mode: "transit" })));

    expect(res.status).toBe(502);
    // The mode is in the body so a spike of transit-only failures is
    // greppable in logs without a code change.
    await expect(res.json()).resolves.toEqual({ error: "No route found.", mode: "transit" });
  });
});

describe("guest routing endpoint — response cache", () => {
  it("serves an identical repeat request without billing Google twice", async () => {
    const target = url({ mode: "transit" });

    const first = await GET(request(target));
    const second = await GET(request(target));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(getTransitRoute).toHaveBeenCalledTimes(1);
    await expect(second.json()).resolves.toEqual({ route: ROUTE });
  });

  it("does not serve a walking request from a transit cache entry", async () => {
    const search = new URLSearchParams({
      originLng: "4.8375",
      originLat: "52.3889",
      destLng: "4.8996",
      destLat: "52.3703",
    });
    const walk = `http://localhost/api/guest/walking-route?${search.toString()}`;
    const transit = `${walk}&mode=transit`;

    await GET(request(transit));
    await GET(request(walk));

    expect(getTransitRoute).toHaveBeenCalledTimes(1);
    expect(getWalkingRoute).toHaveBeenCalledTimes(1);
  });
});

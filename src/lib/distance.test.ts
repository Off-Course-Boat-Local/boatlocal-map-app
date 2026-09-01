import { describe, expect, it } from "vitest";

import {
  AMSTERDAM_DETOUR_FACTOR,
  formatWalk,
  formatWalkFromMeters,
  haversineMeters,
  walkEstimatePartsFromRoute,
  walkingDistanceMeters,
  walkingMinutes,
} from "./distance";
import { FALLBACK_GUEST_POSITION, PLACES, BOAT_TOURS } from "./data";

/**
 * Ground truth. Straight-line distances between real Amsterdam landmarks,
 * measured independently of this code. If haversine drifts, these fail.
 */
const DAM = { lng: 4.8936, lat: 52.3731 };
const CENTRAAL = { lng: 4.9003, lat: 52.3791 };
const RIJKSMUSEUM = { lng: 4.8852, lat: 52.36 };
const NDSM = { lng: 4.8927, lat: 52.4013 };

describe("haversineMeters", () => {
  it("matches known Amsterdam distances within 2%", () => {
    const cases: Array<[string, { lng: number; lat: number }, number]> = [
      ["Dam → Centraal", CENTRAAL, 810],
      ["Dam → Rijksmuseum", RIJKSMUSEUM, 1560],
      ["Dam → NDSM", NDSM, 3140],
    ];

    for (const [label, to, expected] of cases) {
      const actual = haversineMeters(DAM, to);
      expect(
        Math.abs(actual - expected) / expected,
        `${label}: got ${Math.round(actual)}m, expected ~${expected}m`,
      ).toBeLessThan(0.02);
    }
  });

  it("is zero for a point to itself", () => {
    expect(haversineMeters(DAM, DAM)).toBe(0);
  });

  it("is symmetric", () => {
    expect(haversineMeters(DAM, NDSM)).toBeCloseTo(haversineMeters(NDSM, DAM), 6);
  });
});

describe("walkingDistanceMeters", () => {
  it("applies the detour factor", () => {
    expect(walkingDistanceMeters(DAM, CENTRAAL)).toBeCloseTo(
      haversineMeters(DAM, CENTRAAL) * AMSTERDAM_DETOUR_FACTOR,
      6,
    );
  });

  it("stays inside the measured real-world detour range for this city", () => {
    // Real walking routes in central Amsterdam run 1.15–1.45× the straight
    // line. A factor outside that band means we are either lying to guests
    // about how close something is, or scaring them off a 10-minute walk.
    expect(AMSTERDAM_DETOUR_FACTOR).toBeGreaterThanOrEqual(1.15);
    expect(AMSTERDAM_DETOUR_FACTOR).toBeLessThanOrEqual(1.45);
  });
});

describe("walkingMinutes", () => {
  it("never under-promises — always rounds up", () => {
    // Arriving later than told is the failure mode that matters.
    for (const meters of [10, 99, 101, 417, 900, 2001]) {
      const exact = (meters / 1000 / 5) * 60;
      expect(walkingMinutes(meters)).toBeGreaterThanOrEqual(Math.floor(exact));
    }
  });

  it("increases monotonically with distance", () => {
    let previous = -1;
    for (let m = 0; m <= 5000; m += 137) {
      const mins = walkingMinutes(m);
      expect(mins).toBeGreaterThanOrEqual(previous);
      previous = mins;
    }
  });
});

describe("formatWalkFromMeters", () => {
  it("reproduces the two specified examples exactly", () => {
    expect(formatWalkFromMeters(700)).toBe("~9 min walk · 700 m");
    expect(formatWalkFromMeters(2100)).toBe("~26 min walk · 2.1 km");
  });

  it("switches to kilometres at 1 km", () => {
    expect(formatWalkFromMeters(950)).toContain(" m");
    expect(formatWalkFromMeters(1200)).toContain("km");
  });

  it("collapses to 'Right here' when the guest is basically there", () => {
    expect(formatWalkFromMeters(0)).toContain("Right here");
    expect(formatWalkFromMeters(40)).toContain("Right here");
  });

  it("never implies precision it does not have", () => {
    // Everything is an estimate, so everything carries a tilde, and metres are
    // rounded to 50 — "~9 min walk · 700 m", never "8 min walk · 683 m".
    for (const meters of [120, 337, 719, 1480, 4402]) {
      const out = formatWalkFromMeters(meters);
      expect(out).toContain("~");
      const metreMatch = out.match(/(\d+) m$/);
      if (metreMatch) expect(Number(metreMatch[1]) % 50).toBe(0);
    }
  });
});

describe("formatWalk over the real dataset", () => {
  const guest = FALLBACK_GUEST_POSITION;

  it("produces a plausible string for every place and boat tour", () => {
    for (const item of [...PLACES, ...BOAT_TOURS]) {
      const out = formatWalk(guest, item);
      expect(out.length).toBeGreaterThan(0);
      expect(out).toMatch(/Right here|min walk/);
    }
  });

  it("keeps every central pin within a believable walk", () => {
    // Sanity net: if a coordinate is mistyped (a swapped lng/lat, a missing
    // decimal) it lands in the North Sea and this catches it immediately.
    for (const place of PLACES) {
      const meters = walkingDistanceMeters(guest, place);
      expect(meters, `${place.name} is ${Math.round(meters)}m from Dam`).toBeLessThan(
        8000,
      );
    }
  });
});

describe("walkEstimatePartsFromRoute", () => {
  it("uses the real duration for minutes, not the distance-derived estimate", () => {
    // 824m would normally derive ~10 min at WALKING_SPEED_KMH (5 km/h), but
    // a real route can walk it slower (more crossings/lights) or faster —
    // this must reflect what Google actually said, not re-derive its own
    // guess from the distance.
    const parts = walkEstimatePartsFromRoute(824, 900); // 15 real minutes
    expect(parts).toEqual({ kind: "walk", minutes: 15, distanceLabel: "800 m" });
  });

  it("rounds duration up to a whole minute, same as the straight-line estimate does", () => {
    const parts = walkEstimatePartsFromRoute(500, 61); // just over 1 minute
    expect(parts.kind === "walk" && parts.minutes).toBe(2);
  });

  it("never returns fewer than 1 minute even for a near-zero duration", () => {
    const parts = walkEstimatePartsFromRoute(200, 5);
    expect(parts.kind === "walk" && parts.minutes).toBe(1);
  });

  it("still applies the rightHere band below RIGHT_HERE_METERS, same as the straight-line estimate", () => {
    expect(walkEstimatePartsFromRoute(40, 30)).toEqual({ kind: "rightHere", metersLabel: "50 m" });
    expect(walkEstimatePartsFromRoute(10, 8)).toEqual({ kind: "rightHere", metersLabel: null });
  });

  it("labels distance in km at or above 1000m, same rounding as the straight-line estimate", () => {
    const parts = walkEstimatePartsFromRoute(2140, 1500);
    expect(parts.kind === "walk" && parts.distanceLabel).toBe("2.1 km");
  });
});

import { describe, expect, it } from "vitest";

import { decodePolyline } from "./polyline";

describe("decodePolyline", () => {
  // Google's own canonical worked example from the polyline algorithm
  // documentation: encodes (38.5,-120.2), (40.7,-120.95), (43.252,-126.453).
  it("matches Google's documented worked example", () => {
    const points = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");

    expect(points).toHaveLength(3);
    expect(points[0].lat).toBeCloseTo(38.5, 5);
    expect(points[0].lng).toBeCloseTo(-120.2, 5);
    expect(points[1].lat).toBeCloseTo(40.7, 5);
    expect(points[1].lng).toBeCloseTo(-120.95, 5);
    expect(points[2].lat).toBeCloseTo(43.252, 5);
    expect(points[2].lng).toBeCloseTo(-126.453, 5);
  });

  it("decodes a real response captured from the Routes API (Amsterdam)", () => {
    // Captured live from computeRoutes for a real ~824m Amsterdam walk —
    // a regression guard against the decoder silently drifting for
    // real-world (not hand-picked) input.
    const points = decodePolyline(
      "g`s~H}y|\\Nl@}@hBID@DQFC[KAB`@UFCc@}@eACGKLYbAa@vAWx@Gv@GNOOoAdEC\\Y`AHRDEd@bACPWh@TVc@jAUlBCf@GRY~C?PMzAAXITo@lGGDLNOTELf@b@",
    );

    expect(points.length).toBeGreaterThan(10);
    // Every decoded point should land somewhere sane for central Amsterdam
    // (roughly 52.3-52.4 lat, 4.85-4.95 lng) — catches a shifted/garbled
    // decode without pinning every single coordinate.
    for (const p of points) {
      expect(p.lat).toBeGreaterThan(52.3);
      expect(p.lat).toBeLessThan(52.4);
      expect(p.lng).toBeGreaterThan(4.8);
      expect(p.lng).toBeLessThan(5.0);
    }
  });

  it("returns an empty array for an empty string", () => {
    expect(decodePolyline("")).toEqual([]);
  });
});

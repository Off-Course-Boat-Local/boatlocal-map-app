import { describe, expect, it } from "vitest";

import { googleMapsWalkingUrl } from "./mapsHandoff";
import { PLACES } from "./data";

const ANNE_FRANK = PLACES.find((p) => p.id === "anne-frank")!;

describe("googleMapsWalkingUrl", () => {
  it("builds a walking-mode Maps URL against the documented api=1 form", () => {
    const url = new URL(
      googleMapsWalkingUrl({
        destLat: ANNE_FRANK.lat,
        destLng: ANNE_FRANK.lng,
        destName: ANNE_FRANK.name,
      }),
    );

    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("travelmode")).toBe("walking");
  });

  it("sends coordinates as the destination, not the name", () => {
    // A name has to be geocoded by Google and can resolve to a different
    // branch, or a same-named place in another city. Coordinates cannot.
    const url = new URL(
      googleMapsWalkingUrl({
        destLat: ANNE_FRANK.lat,
        destLng: ANNE_FRANK.lng,
        destName: ANNE_FRANK.name,
      }),
    );

    const destination = url.searchParams.get("destination") ?? "";
    expect(destination).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/);
    expect(destination).toContain(String(ANNE_FRANK.lat));
    expect(destination).not.toContain("Anne");
  });

  it("never puts the guest's own position in the URL", () => {
    // Privacy invariant. Omitting the origin also gives a *better* result:
    // Google uses the device's live position, which is more accurate than
    // anything we hold — and it keeps working when we have no permission.
    const url = new URL(
      googleMapsWalkingUrl({ destLat: 52.3731, destLng: 4.8936 }),
    );
    expect(url.searchParams.has("origin")).toBe(false);
    expect(url.searchParams.has("saddr")).toBe(false);
  });

  it("survives a name with characters that would otherwise break the URL", () => {
    const url = googleMapsWalkingUrl({
      destLat: 52.3676,
      destLng: 4.8956,
      destName: "Café de Jaren & Co. #1 ?",
    });
    expect(() => new URL(url)).not.toThrow();
  });

  it("produces a valid URL for every place in the dataset", () => {
    for (const place of PLACES) {
      const url = googleMapsWalkingUrl({
        destLat: place.lat,
        destLng: place.lng,
        destName: place.name,
      });
      expect(() => new URL(url), place.name).not.toThrow();
    }
  });
});

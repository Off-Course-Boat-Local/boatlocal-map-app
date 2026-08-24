import { describe, expect, it } from "vitest";

import { parseGoogleMapsUrl } from "./geocode";

describe("parseGoogleMapsUrl", () => {
  it("parses the @lat,lng viewport-centre form", () => {
    expect(parseGoogleMapsUrl("https://www.google.com/maps/@52.3702,4.8952,17z")).toEqual({
      lat: 52.3702,
      lng: 4.8952,
    });
  });

  it("prefers the !3d/!4d exact-place pair over an @lat,lng viewport centre in the same URL", () => {
    const url =
      "https://www.google.com/maps/place/Some+Place/@52.3702,4.8952,17z/data=!4m5!3m4!1s0x0:0x0!8m2!3d52.3751!4d4.9003";
    expect(parseGoogleMapsUrl(url)).toEqual({ lat: 52.3751, lng: 4.9003 });
  });

  it("parses the older ?q=lat,lng link form", () => {
    expect(parseGoogleMapsUrl("https://maps.google.com/?q=52.3702,4.8952")).toEqual({
      lat: 52.3702,
      lng: 4.8952,
    });
  });

  it("returns null for plain garbage input", () => {
    expect(parseGoogleMapsUrl("hello world")).toBeNull();
    expect(parseGoogleMapsUrl("")).toBeNull();
    expect(parseGoogleMapsUrl("   ")).toBeNull();
  });

  it("returns null for a non-Maps Google URL", () => {
    expect(parseGoogleMapsUrl("https://www.google.com/search?q=52.3702,4.8952")).toBeNull();
  });

  it("returns null for a Google Maps link with no embedded coordinates", () => {
    expect(parseGoogleMapsUrl("https://maps.google.com/?q=Amsterdam+Centraal")).toBeNull();
  });
});

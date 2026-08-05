import { describe, expect, it } from "vitest";

import { guestPinActionLabel, guestPinActionUrl } from "./guestActions";

describe("guestPinActionUrl", () => {
  it("routes a boat pin through the attributed booking hand-off, not its raw bookingUrl", () => {
    // The raw per-tour bookingUrl (BoatTourRecord.bookingUrl) is the
    // reference URL for the tour, not the final redirect target — the
    // guest is sent through buildBoatBookingHandoff (src/lib/boatBookingHandoff.ts)
    // instead, so every "Book this tour" tap carries a click id.
    const url = guestPinActionUrl({
      id: "sunset-canal",
      lat: 52.37,
      lng: 4.89,
      name: "Sunset Canal Cruise",
      bookingUrl: "https://boatlocal.nl/tours/sunset-canal-cruise",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("tour")).toBe("sunset-canal");
    expect(parsed.searchParams.get("ref")).toMatch(/^bkl_/);
  });

  it("carries optional trip details (date/guests) and company/guide slugs through to the hand-off", () => {
    const url = guestPinActionUrl(
      {
        id: "sunset-canal",
        lat: 52.37,
        lng: 4.89,
        name: "Sunset Canal Cruise",
        bookingUrl: "https://boatlocal.nl/tours/sunset-canal-cruise",
      },
      {
        selection: { date: new Date(2026, 7, 20), guests: 3 },
        companySlug: "coastal",
        guideSlug: "jan",
      },
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("date")).toBe("2026-08-20");
    expect(parsed.searchParams.get("guests")).toBe("3");
    expect(parsed.searchParams.get("company")).toBe("coastal");
    expect(parsed.searchParams.get("guide")).toBe("jan");
  });

  it("passes campaignParams through to the booking hand-off when set", () => {
    const url = guestPinActionUrl(
      {
        id: "sunset-canal",
        lat: 52.37,
        lng: 4.89,
        name: "Sunset Canal Cruise",
        bookingUrl: "https://boatlocal.nl/tours/sunset-canal-cruise",
      },
      { campaignParams: "utm_source=hotel-lobby" },
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("utm_source")).toBe("hotel-lobby");
  });

  it("falls back to a Google Maps walking-directions URL when there is no bookingUrl", () => {
    const url = guestPinActionUrl({
      id: "bakers-roasters",
      lat: 52.3556,
      lng: 4.8917,
      name: "Bakers & Roasters",
    });
    expect(url).toContain("https://www.google.com/maps/dir/");
    expect(url).toContain("destination=52.3556%2C4.8917");
    expect(url).toContain("travelmode=walking");
  });
});

describe("guestPinActionLabel", () => {
  it("is 'Book this tour' for boats", () => {
    expect(guestPinActionLabel({ isBoat: true })).toBe("Book this tour");
  });

  it("is 'Walking directions' for everything else", () => {
    expect(guestPinActionLabel({ isBoat: false })).toBe("Walking directions");
  });
});

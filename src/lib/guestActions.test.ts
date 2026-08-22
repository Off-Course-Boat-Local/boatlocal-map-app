import { describe, expect, it } from "vitest";

import { guestPinAction, guestPinActionLabel } from "./guestActions";

describe("guestPinAction", () => {
  it("routes a boat pin through the attributed booking hand-off, not its raw bookingUrl", () => {
    // The raw per-tour bookingUrl (BoatTourRecord.bookingUrl) is the
    // reference URL for the tour, not the final redirect target — the
    // guest is sent through buildBoatBookingHandoff (src/lib/boatBookingHandoff.ts)
    // instead, so every "Book this tour" tap carries a click id.
    const { url, clickId } = guestPinAction({
      id: "sunset-canal",
      lat: 52.37,
      lng: 4.89,
      name: "Sunset Canal Cruise",
      bookingUrl: "https://boatlocal.nl/tours/sunset-canal-cruise",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("tour")).toBe("sunset-canal");
    expect(parsed.searchParams.get("ref")).toMatch(/^bkl_/);
    // The returned clickId must be the exact same id embedded in the URL —
    // it's what a caller records alongside the "boat_book_click" analytics
    // event so the BoatLocal conversion webhook can later match the two.
    expect(clickId).toBe(parsed.searchParams.get("ref"));
  });

  it("carries optional trip details (date/guests) and company/guide slugs through to the hand-off", () => {
    const { url } = guestPinAction(
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
    // `distributor`, not `guide` — see buildBookingUrl's doc comment.
    expect(parsed.searchParams.get("distributor")).toBe("jan");
  });

  it("passes campaignParams through to the booking hand-off when set", () => {
    const { url } = guestPinAction(
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

  it("falls back to a Google Maps walking-directions URL when there is no bookingUrl, with no clickId", () => {
    const { url, clickId } = guestPinAction({
      id: "bakers-roasters",
      lat: 52.3556,
      lng: 4.8917,
      name: "Bakers & Roasters",
    });
    expect(url).toContain("https://www.google.com/maps/dir/");
    expect(url).toContain("destination=52.3556%2C4.8917");
    expect(url).toContain("travelmode=walking");
    expect(clickId).toBeUndefined();
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

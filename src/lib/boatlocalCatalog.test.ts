import { describe, expect, it } from "vitest";

import { parseBoatLocalCruise, parseCruiseDeactivatedPayload } from "./boatlocalCatalog";

const VALID_CRUISE = {
  id: 1,
  fareharbor_pk: 85146,
  slug: "shared-old-city-center-boat-tour",
  name: "Amsterdam Boat Tour of the Old City Center",
  cruise_type: "shared",
  cruise_duration: "1 hour & 30 mins",
  starting_price: 29,
  currency: "EUR",
  max_participants: 12,
  company_shortname: "offcourse",
  images: ["https://example.com/photo.jpg"],
  booking_url: "https://boatlocal.nl/cruise/shared-old-city-center-boat-tour",
  active: true,
  updated_at: "2026-08-23T09:00:00Z",
};

describe("parseBoatLocalCruise", () => {
  it("maps a valid catalogue entry to the camelCase BoatLocalCruise shape", () => {
    const parsed = parseBoatLocalCruise(VALID_CRUISE);
    expect(parsed).toEqual({
      id: 1,
      fareharborPk: 85146,
      slug: "shared-old-city-center-boat-tour",
      name: "Amsterdam Boat Tour of the Old City Center",
      cruiseType: "shared",
      cruiseDuration: "1 hour & 30 mins",
      // Absent from this fixture — the live feed serves one per cruise, but
      // the parser tolerates its absence (see the headline tests below).
      headline: null,
      startingPrice: 29,
      currency: "EUR",
      images: ["https://example.com/photo.jpg"],
      bookingUrl: "https://boatlocal.nl/cruise/shared-old-city-center-boat-tour",
      active: true,
      updatedAt: "2026-08-23T09:00:00Z",
      // Not live on BoatLocal's production feed yet as of this fixture — see
      // types.ts's BoatLocalCruise.departure doc comment.
      departure: null,
    });
  });

  it("returns null for non-object input", () => {
    expect(parseBoatLocalCruise(null)).toBeNull();
    expect(parseBoatLocalCruise("nope")).toBeNull();
    expect(parseBoatLocalCruise(42)).toBeNull();
  });

  it("rejects when id/name/booking_url/active are missing or the wrong type", () => {
    for (const field of ["id", "name", "booking_url", "active"]) {
      const broken = { ...VALID_CRUISE };
      delete (broken as Record<string, unknown>)[field];
      expect(parseBoatLocalCruise(broken), `${field} missing`).toBeNull();
    }
  });

  it("tolerates a null/absent fareharbor_pk or slug rather than rejecting the whole row", () => {
    const parsed = parseBoatLocalCruise({ ...VALID_CRUISE, fareharbor_pk: null, slug: null });
    expect(parsed?.fareharborPk).toBeNull();
    expect(parsed?.slug).toBeNull();
  });

  it("parses the headline verbatim when present", () => {
    const parsed = parseBoatLocalCruise({
      ...VALID_CRUISE,
      headline: "BYO Drinks Welcome • Small Group • Hidden Canal Routes",
    });
    expect(parsed?.headline).toBe("BYO Drinks Welcome • Small Group • Hidden Canal Routes");
  });

  it("treats a missing, empty, whitespace-only, or non-string headline as null rather than rejecting the row", () => {
    expect(parseBoatLocalCruise(VALID_CRUISE)?.headline).toBeNull();
    expect(parseBoatLocalCruise({ ...VALID_CRUISE, headline: "" })?.headline).toBeNull();
    expect(parseBoatLocalCruise({ ...VALID_CRUISE, headline: "   " })?.headline).toBeNull();
    expect(parseBoatLocalCruise({ ...VALID_CRUISE, headline: 42 })?.headline).toBeNull();
    expect(parseBoatLocalCruise({ ...VALID_CRUISE, headline: null })?.headline).toBeNull();
  });

  it("defaults images to an empty array rather than rejecting when absent", () => {
    const rest: Partial<typeof VALID_CRUISE> = { ...VALID_CRUISE };
    delete rest.images;
    const parsed = parseBoatLocalCruise(rest);
    expect(parsed?.images).toEqual([]);
  });

  describe("departure (BoatLocal's not-yet-live per-cruise coordinates)", () => {
    it("parses a google_maps_link departure into the camelCase shape", () => {
      const parsed = parseBoatLocalCruise({
        ...VALID_CRUISE,
        departure: {
          lat: 52.3651118,
          lng: 4.9034867,
          address: "Nieuwe Keizersgracht 1, 1018 DS Amsterdam",
          source: "google_maps_link",
        },
      });
      expect(parsed?.departure).toEqual({
        lat: 52.3651118,
        lng: 4.9034867,
        address: "Nieuwe Keizersgracht 1, 1018 DS Amsterdam",
        source: "google_maps_link",
      });
    });

    it("parses a geocoded_address departure the same way — still real, still per-cruise", () => {
      const parsed = parseBoatLocalCruise({
        ...VALID_CRUISE,
        departure: {
          lat: 52.37,
          lng: 4.89,
          address: "Some free-text address",
          source: "geocoded_address",
        },
      });
      expect(parsed?.departure?.source).toBe("geocoded_address");
    });

    it("treats an explicit null departure as no location data, not a parse failure", () => {
      const parsed = parseBoatLocalCruise({ ...VALID_CRUISE, departure: null });
      expect(parsed).not.toBeNull();
      expect(parsed?.departure).toBeNull();
    });

    it("defaults departure to null when the field is absent entirely (today's reality — not yet shipped)", () => {
      const rest: Partial<typeof VALID_CRUISE> & { departure?: unknown } = { ...VALID_CRUISE };
      delete rest.departure;
      const parsed = parseBoatLocalCruise(rest);
      expect(parsed?.departure).toBeNull();
    });

    it("treats a malformed departure (missing lat/lng/address) as no location data rather than rejecting the whole cruise", () => {
      const parsed = parseBoatLocalCruise({ ...VALID_CRUISE, departure: { source: "google_maps_link" } });
      expect(parsed).not.toBeNull();
      expect(parsed?.departure).toBeNull();
    });

    it("tolerates a missing/non-string source rather than rejecting the whole departure", () => {
      const parsed = parseBoatLocalCruise({
        ...VALID_CRUISE,
        departure: { lat: 1, lng: 2, address: "Somewhere" },
      });
      expect(parsed?.departure).toEqual({ lat: 1, lng: 2, address: "Somewhere", source: null });
    });
  });
});

describe("parseCruiseDeactivatedPayload", () => {
  const VALID_PAYLOAD = {
    event: "cruise.deactivated",
    cruise: { id: 1, slug: "shared-old-city-center-boat-tour", fareharbor_pk: 85146 },
    reason: "removed_from_fareharbor",
    occurred_at: "2026-08-24T03:02:00Z",
  };

  it("parses the deliberately-smaller cruise.deactivated shape", () => {
    const parsed = parseCruiseDeactivatedPayload(VALID_PAYLOAD);
    expect(parsed).toEqual({
      cruise: { id: 1, slug: "shared-old-city-center-boat-tour", fareharborPk: 85146 },
      reason: "removed_from_fareharbor",
    });
  });

  it("is not fooled into requiring the full catalogue shape (name/booking_url/active absent here)", () => {
    // If this ever accidentally ran through parseBoatLocalCruise, it would
    // be rejected for missing name/booking_url/active — this proves the two
    // parsers really are independent.
    expect(parseCruiseDeactivatedPayload(VALID_PAYLOAD)).not.toBeNull();
  });

  it("returns null when cruise.id is missing or the wrong type", () => {
    expect(
      parseCruiseDeactivatedPayload({ ...VALID_PAYLOAD, cruise: { slug: "x", fareharbor_pk: 1 } }),
    ).toBeNull();
  });

  it("tolerates a missing reason (null, not a throw)", () => {
    const rest: Partial<typeof VALID_PAYLOAD> = { ...VALID_PAYLOAD };
    delete rest.reason;
    expect(parseCruiseDeactivatedPayload(rest)?.reason).toBeNull();
  });

  it("returns null for non-object input or a missing cruise field", () => {
    expect(parseCruiseDeactivatedPayload(null)).toBeNull();
    expect(parseCruiseDeactivatedPayload({ reason: "admin_disabled" })).toBeNull();
  });
});

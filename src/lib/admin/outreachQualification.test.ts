import { describe, expect, it } from "vitest";

import type { ExistingPartnerIdentifiers } from "@/lib/data/outreach";
import type { PlaceCandidate } from "./placeCandidates";
import { candidateQueriesFor, looksLikeChainByName, qualify } from "./outreachQualification";

const EMPTY_KNOWN: ExistingPartnerIdentifiers = {
  googlePlaceIds: new Set(),
  websiteDomains: new Set(),
  prospectNames: new Set(),
  companyNames: new Set(),
};

const HOTEL_CANDIDATE: PlaceCandidate = {
  googlePlaceId: "ChIJhotel",
  name: "Hotel V Nesplein",
  address: "Nes 49, Amsterdam",
  website: "hotelvnesplein.com",
  phone: "+31 20 000 0000",
  rating: 4.7,
  reviewCount: 2140,
  types: ["lodging", "hotel"],
  primaryType: "hotel",
  businessStatus: "OPERATIONAL",
};

const OPERATOR_CANDIDATE: PlaceCandidate = {
  googlePlaceId: "ChIJoperator",
  name: "Amsterdam Walking Tours",
  address: "Damrak 1, Amsterdam",
  website: "amsterdamwalkingtours.example",
  phone: null,
  rating: 4.8,
  reviewCount: 500,
  types: ["tourist_attraction", "point_of_interest"],
  primaryType: "walking_tour_agency",
  businessStatus: "OPERATIONAL",
};

describe("looksLikeChainByName", () => {
  it("catches well-known chain brands, case-insensitively", () => {
    expect(looksLikeChainByName("Amsterdam Marriott Hotel")).toBe(true);
    expect(looksLikeChainByName("citizenM Amsterdam")).toBe(true);
    expect(looksLikeChainByName("NH Collection Amsterdam Barbizon Palace")).toBe(true);
  });

  it("does not flag an independent hotel", () => {
    expect(looksLikeChainByName("Hotel V Nesplein")).toBe(false);
    expect(looksLikeChainByName("The Toren")).toBe(false);
  });
});

describe("candidateQueriesFor", () => {
  it("returns 8 hotel queries (4 neighbourhoods x 2 query types) for a given week", () => {
    const queries = candidateQueriesFor("hotel", new Date("2026-09-03T00:00:00Z"));
    expect(queries).toHaveLength(8);
    expect(queries.every((q) => q.includes("Amsterdam"))).toBe(true);
  });

  it("rotates to a different set of neighbourhoods a few weeks later", () => {
    const week1 = candidateQueriesFor("hotel", new Date("2026-09-03T00:00:00Z"));
    const week5 = candidateQueriesFor("hotel", new Date("2026-10-01T00:00:00Z"));
    expect(week1).not.toEqual(week5);
  });

  it("returns the fixed operator query set regardless of date", () => {
    const queries = candidateQueriesFor("operator");
    expect(queries).toEqual(
      expect.arrayContaining(["walking tours Amsterdam", "bike tours Amsterdam", "food tours Amsterdam"]),
    );
  });

  it("returns nothing for agency — not sourced by the routine yet", () => {
    expect(candidateQueriesFor("agency")).toEqual([]);
  });
});

describe("qualify", () => {
  it("keeps a hotel that clears every bar", () => {
    expect(qualify(HOTEL_CANDIDATE, "hotel", EMPTY_KNOWN)).toEqual({ reason: null });
  });

  it("rejects a hotel below the rating/review threshold", () => {
    expect(qualify({ ...HOTEL_CANDIDATE, rating: 3.5 }, "hotel", EMPTY_KNOWN)).toEqual({
      reason: "low_rating_or_reviews",
    });
    expect(qualify({ ...HOTEL_CANDIDATE, reviewCount: 10 }, "hotel", EMPTY_KNOWN)).toEqual({
      reason: "low_rating_or_reviews",
    });
  });

  it("rejects an obvious chain by name", () => {
    expect(qualify({ ...HOTEL_CANDIDATE, name: "Amsterdam Marriott Hotel" }, "hotel", EMPTY_KNOWN)).toEqual({
      reason: "chain",
    });
  });

  it("rejects a non-operational place before checking anything else", () => {
    expect(
      qualify({ ...HOTEL_CANDIDATE, businessStatus: "CLOSED_PERMANENTLY", rating: null }, "hotel", EMPTY_KNOWN),
    ).toEqual({ reason: "not_operational" });
  });

  it("rejects a place with no website", () => {
    expect(qualify({ ...HOTEL_CANDIDATE, website: null }, "hotel", EMPTY_KNOWN)).toEqual({ reason: "no_website" });
  });

  it("rejects by existing google place id, website domain, prospect name, or company name", () => {
    expect(
      qualify(HOTEL_CANDIDATE, "hotel", { ...EMPTY_KNOWN, googlePlaceIds: new Set(["ChIJhotel"]) }),
    ).toEqual({ reason: "already_known" });
    expect(
      qualify(HOTEL_CANDIDATE, "hotel", { ...EMPTY_KNOWN, websiteDomains: new Set(["hotelvnesplein.com"]) }),
    ).toEqual({ reason: "already_known" });
    expect(
      qualify(HOTEL_CANDIDATE, "hotel", { ...EMPTY_KNOWN, prospectNames: new Set(["hotel v nesplein"]) }),
    ).toEqual({ reason: "already_known" });
    expect(
      qualify(HOTEL_CANDIDATE, "hotel", { ...EMPTY_KNOWN, companyNames: new Set(["hotel v nesplein"]) }),
    ).toEqual({ reason: "already_known" });
  });

  it("keeps an operator whose type matches, rejects a boat tour (BoatLocal already covers those)", () => {
    expect(qualify(OPERATOR_CANDIDATE, "operator", EMPTY_KNOWN)).toEqual({ reason: null });
    expect(
      qualify({ ...OPERATOR_CANDIDATE, name: "Amsterdam Canal Boat Tours" }, "operator", EMPTY_KNOWN),
    ).toEqual({ reason: "wrong_type" });
  });

  it("rejects an operator whose type doesn't match bike/walking/food/museum/sightseeing", () => {
    expect(
      qualify(
        { ...OPERATOR_CANDIDATE, name: "Some Random Shop", types: ["store"], primaryType: "store" },
        "operator",
        EMPTY_KNOWN,
      ),
    ).toEqual({ reason: "wrong_type" });
  });
});

import { describe, expect, it } from "vitest";

import {
  getDefaultBoatBookingSelection,
  buildBoatBookingHandoff,
  formatBookingDate,
  formatBookingDateLabel,
  mergeCampaignParams,
} from "./boatBookingHandoff";

const TOUR_BOOKING_URL = "https://boatlocal.nl/cruise/sunset-canal-cruise";

describe("getDefaultBoatBookingSelection", () => {
  it("defaults to today's date and a party of two", () => {
    const selection = getDefaultBoatBookingSelection();
    expect(selection.guests).toBe(2);
    expect(selection.date).toBeInstanceOf(Date);
    expect(formatBookingDate(selection.date!)).toBe(formatBookingDate(new Date()));
  });

  it("returns a fresh Date each call, not a shared reference", () => {
    const a = getDefaultBoatBookingSelection();
    const b = getDefaultBoatBookingSelection();
    expect(a.date).not.toBe(b.date);
  });
});

describe("formatBookingDate", () => {
  it("formats as YYYY-MM-DD, zero-padded", () => {
    expect(formatBookingDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(formatBookingDate(new Date(2026, 10, 20))).toBe("2026-11-20");
  });
});

describe("formatBookingDateLabel", () => {
  it("is a short, locale-pinned label regardless of environment locale", () => {
    // Weekday intentionally not hardcoded here (it depends on the exact
    // calendar date) — the shape and the month/day formatting are what this
    // guards, plus that it never throws or drifts with the host locale.
    expect(formatBookingDateLabel(new Date(2026, 7, 20))).toMatch(
      /^[A-Za-z]{3}, Aug 20$/,
    );
  });
});

describe("buildBoatBookingHandoff", () => {
  it("appends onto the tour's own bookingUrl and carries a freshly minted click id when none is injected", () => {
    const { url, clickId } = buildBoatBookingHandoff({
      bookingUrl: TOUR_BOOKING_URL,
      selection: { date: null, guests: 0 },
    });
    expect(clickId.startsWith("bkl_")).toBe(true);
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(TOUR_BOOKING_URL);
    expect(parsed.searchParams.get("ref")).toBe(clickId);
    expect(parsed.searchParams.get("src")).toBe("map-app");
  });

  it("uses an injected click id instead of minting one, for deterministic call sites", () => {
    const { clickId } = buildBoatBookingHandoff({
      bookingUrl: TOUR_BOOKING_URL,
      selection: { date: null, guests: 0 },
      clickId: "bkl_fixed",
    });
    expect(clickId).toBe("bkl_fixed");
  });

  it("carries the picked date and guest count as URL params", () => {
    const { url } = buildBoatBookingHandoff({
      bookingUrl: TOUR_BOOKING_URL,
      selection: { date: new Date(2026, 7, 20), guests: 4 },
      clickId: "bkl_fixed",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("date")).toBe("2026-08-20");
    expect(parsed.searchParams.get("guests")).toBe("4");
  });

  it("omits date/guests rather than sending empty/zero values when the guest skipped the picker", () => {
    const { url } = buildBoatBookingHandoff({
      bookingUrl: TOUR_BOOKING_URL,
      selection: { date: null, guests: 0 },
      clickId: "bkl_fixed",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.has("date")).toBe(false);
    expect(parsed.searchParams.has("guests")).toBe(false);
  });

  it("carries companySlug/guideSlug through to the company/distributor params", () => {
    const { url } = buildBoatBookingHandoff({
      bookingUrl: TOUR_BOOKING_URL,
      selection: { date: null, guests: 0 },
      companySlug: "coastal",
      guideSlug: "jan",
      clickId: "bkl_fixed",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("company")).toBe("coastal");
    // `distributor`, not `guide` — boatlocal.nl's own codebase has an
    // unrelated "Guides" concept; see attribution.ts's buildBookingUrl.
    expect(parsed.searchParams.get("distributor")).toBe("jan");
  });

  it("folds a tenant's campaign params (Studio > Campaign) onto the booking URL", () => {
    const { url } = buildBoatBookingHandoff({
      bookingUrl: TOUR_BOOKING_URL,
      selection: { date: null, guests: 0 },
      clickId: "bkl_fixed",
      campaignParams: "utm_source=hotel-lobby&utm_campaign=summer2026",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("utm_source")).toBe("hotel-lobby");
    expect(parsed.searchParams.get("utm_campaign")).toBe("summer2026");
  });

  it("is unaffected when no campaign params are set, same URL as before this field existed", () => {
    const withNull = buildBoatBookingHandoff({
      bookingUrl: TOUR_BOOKING_URL,
      selection: { date: null, guests: 0 },
      clickId: "bkl_fixed",
      campaignParams: null,
    });
    const without = buildBoatBookingHandoff({
      bookingUrl: TOUR_BOOKING_URL,
      selection: { date: null, guests: 0 },
      clickId: "bkl_fixed",
    });
    expect(withNull.url).toBe(without.url);
  });
});

describe("mergeCampaignParams", () => {
  it("returns the URL unchanged when there are no campaign params", () => {
    const url = "https://boatlocal.nl/cruise/sunset-canal-cruise?ref=bkl_fixed";
    expect(mergeCampaignParams(url, undefined)).toBe(url);
    expect(mergeCampaignParams(url, null)).toBe(url);
    expect(mergeCampaignParams(url, "")).toBe(url);
  });

  it("adds new campaign params to the URL", () => {
    const url = "https://boatlocal.nl/cruise/sunset-canal-cruise?ref=bkl_fixed";
    const merged = new URL(mergeCampaignParams(url, "utm_source=lobby"));
    expect(merged.searchParams.get("utm_source")).toBe("lobby");
  });

  it("never lets a campaign param overwrite one the booking URL already set", () => {
    const url = "https://boatlocal.nl/cruise/sunset-canal-cruise?ref=bkl_fixed";
    const merged = new URL(mergeCampaignParams(url, "ref=attacker-controlled"));
    expect(merged.searchParams.get("ref")).toBe("bkl_fixed");
  });
});

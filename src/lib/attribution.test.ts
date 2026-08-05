import { describe, expect, it } from "vitest";
import {
  buildBookingUrl,
  createClickId,
  parseBookingWebhookPayload,
} from "./attribution";

describe("createClickId", () => {
  it("is prefixed and unique across many calls", () => {
    const ids = new Set(Array.from({ length: 200 }, () => createClickId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id.startsWith("bkl_")).toBe(true);
  });

  it("contains no characters that would need URL-encoding as a query value", () => {
    const id = createClickId();
    expect(id).toBe(encodeURIComponent(id));
  });
});

describe("buildBookingUrl", () => {
  it("carries the click id as the ref param, so it survives the redirect", () => {
    const url = new URL(
      buildBookingUrl({ tourId: "sunset-canal", clickId: "bkl_abc123" }),
    );
    expect(url.searchParams.get("ref")).toBe("bkl_abc123");
    expect(url.searchParams.get("tour")).toBe("sunset-canal");
  });

  it("omits optional params rather than sending them as empty strings", () => {
    const url = new URL(
      buildBookingUrl({ tourId: "sunset-canal", clickId: "bkl_abc123" }),
    );
    expect(url.searchParams.has("date")).toBe(false);
    expect(url.searchParams.has("guests")).toBe(false);
    expect(url.searchParams.has("company")).toBe(false);
    expect(url.searchParams.has("guide")).toBe(false);
  });

  it("includes every param when provided", () => {
    const url = new URL(
      buildBookingUrl({
        tourId: "sunset-canal",
        clickId: "bkl_abc123",
        date: "2026-08-20",
        guests: 3,
        companySlug: "coastal",
        guideSlug: "jan",
      }),
    );
    expect(url.searchParams.get("date")).toBe("2026-08-20");
    expect(url.searchParams.get("guests")).toBe("3");
    expect(url.searchParams.get("company")).toBe("coastal");
    expect(url.searchParams.get("guide")).toBe("jan");
  });

  it("produces a URL under the configured base, not a hard-coded one", () => {
    const url = buildBookingUrl({ tourId: "x", clickId: "bkl_y" });
    // Default until BOATLOCAL_WEBHOOK params are confirmed — see docs/attribution.md.
    expect(url.startsWith("https://boatlocal.nl/book")).toBe(true);
  });
});

describe("parseBookingWebhookPayload", () => {
  const validRaw = {
    event: "booking.confirmed",
    click_id: "bkl_abc123",
    booking_id: "BL-1",
    tour_id: "sunset-canal",
    guests: 2,
    amount_cents: 5600,
    currency: "EUR",
    booked_at: "2026-08-20T18:00:00Z",
  };

  it("maps a valid snake_case payload to the camelCase shape the app uses", () => {
    const parsed = parseBookingWebhookPayload(validRaw);
    expect(parsed).toEqual({
      event: "booking.confirmed",
      clickId: "bkl_abc123",
      bookingId: "BL-1",
      tourId: "sunset-canal",
      guests: 2,
      amountCents: 5600,
      currency: "EUR",
      bookedAt: "2026-08-20T18:00:00Z",
    });
  });

  it("defaults optional numeric/currency fields rather than rejecting", () => {
    const rest = { ...validRaw } as Partial<typeof validRaw>;
    delete rest.guests;
    delete rest.amount_cents;
    delete rest.currency;
    const parsed = parseBookingWebhookPayload(rest);
    expect(parsed).toMatchObject({ guests: 0, amountCents: 0, currency: "EUR" });
  });

  it("returns null instead of throwing on non-object input", () => {
    expect(parseBookingWebhookPayload(null)).toBeNull();
    expect(parseBookingWebhookPayload("a string")).toBeNull();
    expect(parseBookingWebhookPayload(42)).toBeNull();
    expect(parseBookingWebhookPayload(undefined)).toBeNull();
  });

  it("rejects an unrecognised event value", () => {
    expect(
      parseBookingWebhookPayload({ ...validRaw, event: "booking.something_else" }),
    ).toBeNull();
  });

  it("rejects when any required string field is missing or empty", () => {
    for (const field of ["click_id", "booking_id", "tour_id", "booked_at"]) {
      const broken = { ...validRaw, [field]: "" };
      expect(parseBookingWebhookPayload(broken), field).toBeNull();
      const missing = { ...validRaw };
      delete (missing as Record<string, unknown>)[field];
      expect(parseBookingWebhookPayload(missing), `${field} missing`).toBeNull();
    }
  });
});

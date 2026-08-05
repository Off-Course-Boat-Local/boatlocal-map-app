// Booking attribution — the part that survives the trip to boatlocal.nl.
//
// This file is safe to import from client OR server code: no secrets, no
// Node built-ins. The webhook signing/verification that DOES need the shared
// secret lives in attributionWebhook.ts instead, which imports "node:crypto"
// — that import fails the build if a client component ever tries to pull it
// in, which is a deliberate guardrail, not an accident.
//
// THE FLOW THIS SUPPORTS
// -----------------------
// 1. Guest taps "Book this tour". We mint a click id and build a boatlocal.nl
//    URL carrying it (buildBookingUrl below).
// 2. If/when that booking completes, boatlocal.nl calls our webhook
//    (src/app/api/webhooks/boatlocal-booking/route.ts) with the same click id
//    echoed back, plus the outcome. See docs/attribution.md for the full
//    contract and what BoatLocal's team needs to configure on their end.
//
// Nothing here talks to a real database yet — see docs/attribution.md for
// exactly what's real vs. dummy right now.

/** boatlocal.nl's booking page, overridable so the real param names/host can
 * be dropped in later without touching any calling code. */
const DEFAULT_BOOKING_BASE_URL = "https://boatlocal.nl/book";

function bookingBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BOOKING_BASE_URL || DEFAULT_BOOKING_BASE_URL;
}

/**
 * A click id is the one piece of data that has to survive the round trip:
 * we hand it to boatlocal.nl, and get it echoed back in the webhook so we
 * can attribute a booking to the click that produced it, without
 * boatlocal.nl ever needing to know our internal company/guide model.
 *
 * "bkl_" prefix makes these visually distinguishable from boatlocal.nl's own
 * ids in logs and in the webhook payload.
 */
export function createClickId(): string {
  const raw =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : // Extremely old runtime fallback — not cryptographically strong, but
        // this id only needs to be unique, not secret.
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `bkl_${raw.replace(/-/g, "")}`;
}

export interface BookingUrlParams {
  tourId: string;
  clickId: string;
  date?: string; // YYYY-MM-DD
  guests?: number;
  companySlug?: string;
  guideSlug?: string;
}

/**
 * Builds the URL a guest is redirected to when they book. `ref` is the
 * parameter we're asking boatlocal.nl to store against the resulting
 * booking and echo back in the webhook — see docs/attribution.md for the
 * exact ask. Every param name here is a placeholder until BoatLocal's team
 * confirms the real ones; changing them is a one-line edit to this function,
 * not a rewrite of every call site.
 */
export function buildBookingUrl(params: BookingUrlParams): string {
  const url = new URL(bookingBaseUrl());
  url.searchParams.set("tour", params.tourId);
  url.searchParams.set("ref", params.clickId);
  if (params.date) url.searchParams.set("date", params.date);
  if (params.guests != null) url.searchParams.set("guests", String(params.guests));
  if (params.companySlug) url.searchParams.set("company", params.companySlug);
  if (params.guideSlug) url.searchParams.set("guide", params.guideSlug);
  return url.toString();
}

export type BookingWebhookEvent = "booking.confirmed" | "booking.cancelled";

export interface BookingWebhookPayload {
  event: BookingWebhookEvent;
  clickId: string;
  bookingId: string;
  tourId: string;
  guests: number;
  amountCents: number;
  currency: string;
  bookedAt: string; // ISO 8601
}

/**
 * The wire shape uses snake_case (matching typical webhook conventions and
 * making the contract doc in docs/attribution.md copy-pasteable for
 * BoatLocal's team); this maps it to the camelCase shape the rest of the app
 * uses. Returns null rather than throwing — a malformed webhook body is
 * something the route handler reports as a 400, not a crash.
 */
export function parseBookingWebhookPayload(
  json: unknown,
): BookingWebhookPayload | null {
  if (typeof json !== "object" || json === null) return null;
  const j = json as Record<string, unknown>;

  const event = j.event;
  if (event !== "booking.confirmed" && event !== "booking.cancelled") return null;

  const clickId = j.click_id;
  const bookingId = j.booking_id;
  const tourId = j.tour_id;
  const bookedAt = j.booked_at;
  if (
    typeof clickId !== "string" ||
    !clickId ||
    typeof bookingId !== "string" ||
    !bookingId ||
    typeof tourId !== "string" ||
    !tourId ||
    typeof bookedAt !== "string" ||
    !bookedAt
  ) {
    return null;
  }

  const guests = typeof j.guests === "number" ? j.guests : 0;
  const amountCents = typeof j.amount_cents === "number" ? j.amount_cents : 0;
  const currency = typeof j.currency === "string" ? j.currency : "EUR";

  return {
    event,
    clickId,
    bookingId,
    tourId,
    guests,
    amountCents,
    currency,
    bookedAt,
  };
}

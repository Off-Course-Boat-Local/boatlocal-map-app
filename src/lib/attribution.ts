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
// 1. Guest taps "Book this tour". We mint a click id and append tracking
//    params onto the TOUR'S OWN boatlocal.nl page (buildBookingUrl below) —
//    not a URL we assemble ourselves. BoatLocal's confirmed design: Map App
//    is a traffic source, not the owner of the booking destination.
//    `https://boatlocal.nl/book` never existed (always 404s); the real
//    destination is a per-cruise catalogue page BoatLocal's own
//    `GET /api/public/cruises` feed (and matching webhooks) hand us verbatim
//    as `booking_url` — see src/lib/data/source.ts's syncCruiseFromBoatLocal.
// 2. If/when that booking completes, boatlocal.nl calls our webhook
//    (src/app/api/webhooks/boatlocal-booking/route.ts) with the same click id
//    echoed back, plus the outcome. See docs/attribution.md for the full
//    contract and what BoatLocal's team needs to configure on their end.
//
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
  /**
   * The tour's own boatlocal.nl page (BoatTourRecord.bookingUrl), returned
   * verbatim by BoatLocal's catalogue feed/webhooks. Every param below is
   * appended to THIS url — there is no fixed global base to build from any
   * more (see this file's header comment for why). There is also no `tour`
   * param any more: the destination URL is already specific to one cruise,
   * so it carries nothing that identifies which one — that's implicit in
   * which bookingUrl was passed in.
   */
  bookingUrl: string;
  clickId: string;
  date?: string; // YYYY-MM-DD
  guests?: number;
  companySlug?: string;
  guideSlug?: string;
}

/**
 * Builds the URL a guest is redirected to when they book, by appending
 * tracking params onto the tour's own booking page. `ref` is the parameter
 * boatlocal.nl stores against the resulting booking and echoes back in the
 * webhook; `src=map-app` is sent unconditionally so BoatLocal's own
 * analytics can tell Map App traffic apart from their other channels
 * (Google Ads, their own affiliate `?partner=` param, etc.) without needing
 * to infer it from `ref`'s presence — see docs/attribution.md for the full,
 * now-confirmed param contract.
 *
 * NOTE: the guide identifier is sent as `distributor`, not `guide`. Their
 * real codebase already has an unrelated "Guides" concept (SEO blog content
 * under src/content/amsterdam/) — sending `guide=jan` would read as if it
 * referred to that, in their logs and code, not to ours. `partner` was
 * avoided too, since it already means something specific on their side
 * (their own payee/commission affiliate param — see docs/attribution.md).
 * `guideSlug` stays the field name here since it's accurate for our own
 * data; only the wire param sent to their system changed.
 */
export function buildBookingUrl(params: BookingUrlParams): string {
  const url = new URL(params.bookingUrl);
  url.searchParams.set("ref", params.clickId);
  url.searchParams.set("src", "map-app");
  if (params.date) url.searchParams.set("date", params.date);
  if (params.guests != null) url.searchParams.set("guests", String(params.guests));
  if (params.companySlug) url.searchParams.set("company", params.companySlug);
  if (params.guideSlug) url.searchParams.set("distributor", params.guideSlug);
  return url.toString();
}

// NOTE on rebooking: BoatLocal's `/api/booking/modify` rebook flow already
// naturally decomposes into a `booking.cancelled` (the old booking) followed
// by a `booking.confirmed` (the new one) — there is no separate
// "booking.rebooked" event, and none is needed. recordBookingOutcome's
// cancellation-netting (src/lib/data/source.ts) already makes that pair net
// to zero in every "tours booked" style sum, which is the only behavior a
// combined event type would have bought.
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
  /**
   * Echoed fallback-attribution fields BoatLocal may not send yet (all
   * optional — see recordBookingOutcome in src/lib/data/source.ts for how
   * source/sourceDistributor get used when the click-id lookup itself comes
   * up empty). Undefined, not defaulted, when absent or the wrong type:
   * unlike guests/amountCents/currency above, there is no sane default for
   * "which company" — absent must stay indistinguishable from "not sent."
   */
  source?: string;
  sourceCompany?: string;
  sourceDistributor?: string;
  cruiseSlug?: string;
  cruiseFareharborPk?: number;
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

  // Fallback-attribution echoes (point 6, docs/attribution.md) — optional,
  // undefined (not defaulted) when absent or the wrong type, since
  // recordBookingOutcome needs to tell "not sent" apart from any real value.
  const source = typeof j.source === "string" ? j.source : undefined;
  const sourceCompany = typeof j.source_company === "string" ? j.source_company : undefined;
  const sourceDistributor =
    typeof j.source_distributor === "string" ? j.source_distributor : undefined;
  const cruiseSlug = typeof j.cruise_slug === "string" ? j.cruise_slug : undefined;
  const cruiseFareharborPk =
    typeof j.cruise_fareharbor_pk === "number" ? j.cruise_fareharbor_pk : undefined;

  return {
    event,
    clickId,
    bookingId,
    tourId,
    guests,
    amountCents,
    currency,
    bookedAt,
    source,
    sourceCompany,
    sourceDistributor,
    cruiseSlug,
    cruiseFareharborPk,
  };
}

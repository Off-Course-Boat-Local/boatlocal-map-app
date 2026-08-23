// Inbound webhook: boatlocal.nl -> us, "a booking from the map app completed."
//
// See docs/attribution.md for the full contract this implements and what
// still needs configuring on BoatLocal's side before this is live.
//
// Real, working code — verifies signatures, rejects replays, and is
// idempotent on booking_id — and, as of this change, actually persists:
// findAttributedClick/recordBookingOutcome (src/lib/data/source.ts) read
// and write the real `events` table via the service-role client, replacing
// the old dev-only in-memory store. See that pair's own doc comment for why
// a booking outcome is just another `events` row, not a separate table.

import { NextResponse } from "next/server";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyWebhookSignature,
} from "@/lib/attributionWebhook";
import { parseBookingWebhookPayload } from "@/lib/attribution";
import { recordBookingOutcome } from "@/lib/data/source";

export async function POST(request: Request) {
  const secret = process.env.BOATLOCAL_WEBHOOK_SECRET;
  if (!secret) {
    // Fails loudly rather than accepting unsigned requests. A webhook that
    // silently trusts its caller because someone forgot to set an env var is
    // a worse failure mode than a visible 500 in the logs.
    console.error(
      "[boatlocal-webhook] BOATLOCAL_WEBHOOK_SECRET is not set — refusing all requests",
    );
    return NextResponse.json(
      { ok: false, error: "webhook not configured" },
      { status: 500 },
    );
  }

  const rawBody = await request.text();

  const verification = verifyWebhookSignature({
    rawBody,
    signatureHeader: request.headers.get(SIGNATURE_HEADER),
    timestampHeader: request.headers.get(TIMESTAMP_HEADER),
    secret,
  });

  if (!verification.ok) {
    console.warn(`[boatlocal-webhook] rejected: ${verification.reason}`);
    return NextResponse.json(
      { ok: false, error: verification.reason },
      { status: verification.reason === "missing-headers" ? 400 : 401 },
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 },
    );
  }

  const payload = parseBookingWebhookPayload(json);
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "invalid-payload-shape" },
      { status: 400 },
    );
  }

  // A click id we don't recognise is still ack'd with 200 — the booking
  // genuinely happened, we just can't attribute it (the click record may
  // have expired, or this is a booking that didn't originate from the map
  // app at all despite carrying a ref). Attribution being unavailable is
  // not the same failure as the webhook being broken, and must not cause
  // BoatLocal's side to retry forever. recordBookingOutcome does the click
  // lookup itself and reports back whether it found one, rather than this
  // route looking it up twice.
  //
  // Wrapped in try/catch on purpose (found missing by BoatLocal's team
  // live-testing this route): an unexpected error here used to propagate
  // uncaught to Next's default handler — a bare 500 with an empty body,
  // giving BoatLocal's side no way to distinguish "our server is down" from
  // "something in this specific request broke us," and no message to log.
  // Every genuinely-invalid-shape case is already handled above as a clean
  // 400 before this point; this catch is the last-resort net for anything
  // truly unexpected (a DB outage, etc.), so it still reports 500 — just
  // with a body, not silence.
  let inserted: boolean;
  let attributed: boolean;
  try {
    ({ inserted, attributed } = await recordBookingOutcome({
      clickId: payload.clickId,
      bookingId: payload.bookingId,
      event: payload.event,
      tourId: payload.tourId,
      guests: payload.guests,
      amountCents: payload.amountCents,
      currency: payload.currency,
      bookedAt: payload.bookedAt,
      // Fallback attribution (docs/attribution.md point 6) — only ever
      // consulted by recordBookingOutcome when the clickId lookup above
      // comes up empty; BoatLocal may not send these yet, which is fine,
      // since they're optional on the parsed payload too.
      sourceCompany: payload.sourceCompany,
      sourceDistributor: payload.sourceDistributor,
    }));
  } catch (err) {
    console.error(
      `[boatlocal-webhook] recordBookingOutcome threw for booking ${payload.bookingId}:`,
      err,
    );
    return NextResponse.json(
      { ok: false, error: "internal-error" },
      { status: 500 },
    );
  }

  if (!attributed) {
    console.warn(
      `[boatlocal-webhook] booking ${payload.bookingId} referenced unknown click ${payload.clickId} — recording as unattributed`,
    );
  }

  return NextResponse.json({
    ok: true,
    deduplicated: !inserted,
    attributed,
  });
}

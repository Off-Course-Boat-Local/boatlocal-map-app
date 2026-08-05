// Inbound webhook: boatlocal.nl -> us, "a booking from the map app completed."
//
// See docs/attribution.md for the full contract this implements and what
// still needs configuring on BoatLocal's side before this is live.
//
// This is real, working code today — it verifies signatures, rejects
// replays, and is idempotent on booking_id — but it stores outcomes in the
// DEV-ONLY in-memory store from attributionStore.ts, since no live database
// exists yet. That is the one thing that changes when the schema is real;
// everything else here is production-shaped.

import { NextResponse } from "next/server";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyWebhookSignature,
} from "@/lib/attributionWebhook";
import { parseBookingWebhookPayload } from "@/lib/attribution";
import { getClick, recordBooking } from "@/lib/attributionStore";

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
  // BoatLocal's side to retry forever.
  const click = getClick(payload.clickId);
  if (!click) {
    console.warn(
      `[boatlocal-webhook] booking ${payload.bookingId} referenced unknown click ${payload.clickId} — recording as unattributed`,
    );
  }

  const { inserted } = recordBooking({
    bookingId: payload.bookingId,
    clickId: payload.clickId,
    event: payload.event,
    tourId: payload.tourId,
    guests: payload.guests,
    amountCents: payload.amountCents,
    currency: payload.currency,
    bookedAt: payload.bookedAt,
  });

  return NextResponse.json({
    ok: true,
    deduplicated: !inserted,
    attributed: !!click,
  });
}

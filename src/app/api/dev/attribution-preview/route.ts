// DEV-ONLY. Exercises the full click -> boatlocal.nl -> webhook round trip
// with dummy data, without needing BoatLocal's real webhook or a live
// database. This is the thing to hit when you want to SEE the attribution
// flow work, not just read about it in docs/attribution.md.
//
// GET /api/dev/attribution-preview
//
// Deliberately 404s outside development — this simulates an incoming
// webhook using a secret pulled from the environment, and a preview
// endpoint that can forge signed webhook calls has no business existing in
// a deployed app.

import { NextResponse } from "next/server";
import { buildBookingUrl, createClickId } from "@/lib/attribution";
import { signWebhookBody, TIMESTAMP_HEADER, SIGNATURE_HEADER } from "@/lib/attributionWebhook";
import { recordClick, dangerouslyGetAllRecords } from "@/lib/attributionStore";
import { POST as webhookHandler } from "@/app/api/webhooks/boatlocal-booking/route";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  const secret = process.env.BOATLOCAL_WEBHOOK_SECRET || "dev-preview-secret-not-for-real-use";

  // Step 1 — a guest taps "Book this tour".
  const clickId = createClickId();
  const click = recordClick({
    clickId,
    tourId: "sunset-canal",
    companySlug: "coastal",
    guideSlug: "jan",
    date: "2026-08-20",
    guests: 2,
  });
  const bookingUrl = buildBookingUrl({
    tourId: click.tourId,
    clickId,
    date: click.date,
    guests: click.guests,
    companySlug: click.companySlug,
    guideSlug: click.guideSlug,
  });

  // Step 2 — simulate BoatLocal's system calling us back once that booking
  // completes. This is the payload/signature BoatLocal's real system would
  // send once configured per docs/attribution.md.
  const webhookBody = JSON.stringify({
    event: "booking.confirmed",
    click_id: clickId,
    booking_id: `BL-DEMO-${Date.now()}`,
    tour_id: click.tourId,
    guests: click.guests,
    amount_cents: 5600,
    currency: "EUR",
    booked_at: new Date().toISOString(),
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signWebhookBody(webhookBody, secret, timestamp);

  const simulatedRequest = new Request(
    "http://localhost/api/webhooks/boatlocal-booking",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [TIMESTAMP_HEADER]: String(timestamp),
        [SIGNATURE_HEADER]: signature,
      },
      body: webhookBody,
    },
  );

  // Force the handler to see the same secret we signed with, in case
  // BOATLOCAL_WEBHOOK_SECRET isn't set in this dev environment yet.
  const previousSecret = process.env.BOATLOCAL_WEBHOOK_SECRET;
  process.env.BOATLOCAL_WEBHOOK_SECRET = secret;
  const webhookResponse = await webhookHandler(simulatedRequest);
  process.env.BOATLOCAL_WEBHOOK_SECRET = previousSecret;

  const webhookResult = await webhookResponse.json();

  return NextResponse.json({
    step1_guestTapsBook: { clickId, bookingUrl },
    step2_boatlocalCallsWebhook: {
      body: JSON.parse(webhookBody),
      headers: { [TIMESTAMP_HEADER]: timestamp, [SIGNATURE_HEADER]: signature },
    },
    step3_ourWebhookResponse: {
      status: webhookResponse.status,
      body: webhookResult,
    },
    storeContents: dangerouslyGetAllRecords(),
  });
}

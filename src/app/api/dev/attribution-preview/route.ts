// DEV-ONLY. Exercises the full click -> boatlocal.nl -> webhook round trip
// against REAL data, without needing BoatLocal's real webhook. This is the
// thing to hit when you want to SEE the attribution flow work, not just
// read about it in docs/attribution.md.
//
// GET /api/dev/attribution-preview
//
// Deliberately 404s outside development — this simulates an incoming
// webhook using a secret pulled from the environment, and a preview
// endpoint that can forge signed webhook calls has no business existing in
// a deployed app.
//
// As of this change, "step 1" writes a REAL boat_book_click event (via
// recordEvent, same as a genuine guest tap) instead of the old dummy
// in-memory store — so this route now exercises the exact same code path a
// real "Book this tour" tap does, start to finish, against the seeded demo
// company/guide (DEMO_COMPANY_ID/DEMO_GUIDE_SLUG below). Run
// `node scripts/verify-db.mjs` afterwards to see the resulting rows in
// `events` directly.

import { NextResponse } from "next/server";
import { buildBookingUrl, createClickId } from "@/lib/attribution";
import { signWebhookBody, TIMESTAMP_HEADER, SIGNATURE_HEADER } from "@/lib/attributionWebhook";
import { findAttributedClick, getActiveCompanyRecord, getGuide, recordEvent } from "@/lib/data/source";
import { POST as webhookHandler } from "@/app/api/webhooks/boatlocal-booking/route";

// The one company/guide supabase/seed.sql (and src/lib/data/fakeStore.ts)
// always seed with these exact fixed ids — companies no longer have a
// human-typed identifier (subdomain) to look one up by, so this hits the
// known seed row directly instead.
const DEMO_COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_GUIDE_SLUG = "jan";
const DEMO_TOUR_ID = "sunset-canal";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  const secret = process.env.BOATLOCAL_WEBHOOK_SECRET || "dev-preview-secret-not-for-real-use";

  // Step 1 — a guest taps "Book this tour". Resolve the demo tenant's real
  // ids exactly as guestServerContext.ts does, then record the same
  // boat_book_click event GuestMapScreen's onAction fires for a real tap —
  // this is the one thing making the webhook able to attribute anything.
  const company = await getActiveCompanyRecord(DEMO_COMPANY_ID);
  const guide = company ? await getGuide(company.id, DEMO_GUIDE_SLUG) : null;

  const clickId = createClickId();
  await recordEvent({
    eventType: "boat_book_click",
    companyId: company?.id ?? null,
    guideId: guide?.id ?? null,
    boatTourId: DEMO_TOUR_ID,
    platform: "unknown",
    metadata: { clickId },
  });

  const bookingUrl = buildBookingUrl({
    tourId: DEMO_TOUR_ID,
    clickId,
    date: "2026-08-20",
    guests: 2,
    companySlug: DEMO_COMPANY_ID,
    guideSlug: DEMO_GUIDE_SLUG,
  });

  // Step 2 — simulate BoatLocal's system calling us back once that booking
  // completes. This is the payload/signature BoatLocal's real system would
  // send once configured per docs/attribution.md.
  const webhookBody = JSON.stringify({
    event: "booking.confirmed",
    click_id: clickId,
    booking_id: `BL-DEMO-${Date.now()}`,
    tour_id: DEMO_TOUR_ID,
    guests: 2,
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
    step1_guestTapsBook: {
      clickId,
      bookingUrl,
      attributedTo: company
        ? { companyId: company.id, companyName: company.name, guideId: guide?.id ?? null, guideName: guide?.name ?? null }
        : { warning: `No active company found at id "${DEMO_COMPANY_ID}" — click was recorded unattributed.` },
    },
    step2_boatlocalCallsWebhook: {
      body: JSON.parse(webhookBody),
      headers: { [TIMESTAMP_HEADER]: timestamp, [SIGNATURE_HEADER]: signature },
    },
    step3_ourWebhookResponse: {
      status: webhookResponse.status,
      body: webhookResult,
    },
    // Re-reads the same lookup the webhook itself just used, so you can see
    // this isn't a fluke of the response body — the click is really there.
    verifiedInDatabase: await findAttributedClick(clickId),
  });
}

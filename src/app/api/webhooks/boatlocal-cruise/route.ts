// Inbound webhook: boatlocal.nl -> us, "a cruise in the catalogue changed."
//
// Separate route from src/app/api/webhooks/boatlocal-booking/route.ts on
// purpose — same signing scheme (reused, not reimplemented, from
// attributionWebhook.ts), but a genuinely different concern: that route
// reports a booking OUTCOME against a click we minted; this one reports a
// change to BoatLocal's own CATALOGUE, which Map App did not initiate and
// has no click/attribution context for at all.
//
// See docs/attribution.md's "cruise catalogue sync" section for the full
// contract. Handles two event types today:
//   - "cruise.activated": upsert via syncCruiseFromBoatLocal
//     (src/lib/data/source.ts).
//   - "cruise.deactivated": hide the one row via deactivateBoatLocalCruise,
//     storing the `reason` field as data only (see that function's doc
//     comment for why this deliberately does not branch on the reason's
//     value).
// A "cruise.updated" event is proposed by BoatLocal but NOT yet agreed —
// any event value this route doesn't recognise is accepted with 200 and a
// no-op, so adding that event type later needs no route change here and
// never causes BoatLocal's side to retry forever over something we simply
// haven't built handling for yet.
//
// Bursts of cruise.deactivated are expected, not exceptional: BoatLocal's
// own daily 03:00 UTC FareHarbor sync can deactivate many cruises in one
// automated run — nothing here assumes events arrive one at a time.

import { NextResponse } from "next/server";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyWebhookSignature,
} from "@/lib/attributionWebhook";
import { parseBoatLocalCruise, parseCruiseDeactivatedPayload } from "@/lib/boatlocalCatalog";
import { deactivateBoatLocalCruise, syncCruiseFromBoatLocal } from "@/lib/data/source";

export async function POST(request: Request) {
  const secret = process.env.BOATLOCAL_WEBHOOK_SECRET;
  if (!secret) {
    // Same fail-loud posture as the booking webhook: refusing every request
    // when the secret isn't configured is a safer failure mode than silently
    // trusting an unsigned caller.
    console.error(
      "[boatlocal-cruise-webhook] BOATLOCAL_WEBHOOK_SECRET is not set — refusing all requests",
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
    console.warn(`[boatlocal-cruise-webhook] rejected: ${verification.reason}`);
    return NextResponse.json(
      { ok: false, error: verification.reason },
      { status: verification.reason === "missing-headers" ? 400 : 401 },
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  if (typeof json !== "object" || json === null) {
    return NextResponse.json({ ok: false, error: "invalid-payload-shape" }, { status: 400 });
  }
  const event = (json as Record<string, unknown>).event;

  // Both branches below are wrapped in try/catch on purpose (same fix as
  // the booking webhook, after BoatLocal's team found that route returning
  // a bare, bodyless 500 on an unexpected error) — every genuinely-invalid
  // shape is already a clean 400 before this point; this is the last-resort
  // net for anything truly unexpected, so BoatLocal's side gets a real
  // status/body to log instead of silence, and still correctly retries.
  if (event === "cruise.activated") {
    const cruise = parseBoatLocalCruise((json as Record<string, unknown>).cruise);
    if (!cruise) {
      return NextResponse.json({ ok: false, error: "invalid-payload-shape" }, { status: 400 });
    }
    try {
      await syncCruiseFromBoatLocal(cruise);
    } catch (err) {
      console.error(`[boatlocal-cruise-webhook] syncCruiseFromBoatLocal threw:`, err);
      return NextResponse.json({ ok: false, error: "internal-error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, event });
  }

  if (event === "cruise.deactivated") {
    const parsed = parseCruiseDeactivatedPayload(json);
    if (!parsed) {
      return NextResponse.json({ ok: false, error: "invalid-payload-shape" }, { status: 400 });
    }
    try {
      await deactivateBoatLocalCruise(parsed.cruise, parsed.reason);
    } catch (err) {
      console.error(`[boatlocal-cruise-webhook] deactivateBoatLocalCruise threw:`, err);
      return NextResponse.json({ ok: false, error: "internal-error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, event });
  }

  // Unrecognised event (e.g. a future "cruise.updated") — accept and no-op
  // rather than reject, so BoatLocal's side never retries forever over an
  // event type we simply haven't built handling for yet.
  console.warn(`[boatlocal-cruise-webhook] ignoring unrecognised event "${String(event)}"`);
  return NextResponse.json({ ok: true, ignored: true });
}

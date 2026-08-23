// Read-only counterpart to ../route.ts (the actual webhook), for BoatLocal's
// own team to verify a delivery landed correctly without Admin dashboard
// access — they asked for exactly this after their first live signed test
// against production: "Right now we're trusting your 200 and can't verify
// independently."
//
// Auth: a bearer-token check against the SAME BOATLOCAL_WEBHOOK_SECRET that
// signs the webhook itself, not HMAC-over-body — this is a bodyless GET, so
// there is no body to sign, and a shared secret both sides already hold is
// the same posture src/app/api/cron/sync-boat-tours/route.ts already uses
// for its own bodyless GET (see that file's comment for why a bearer token
// is the right shape here, not a body signature).

import { NextResponse } from "next/server";
import { getBookingOutcomeStatus } from "@/lib/data/source";

export async function GET(request: Request) {
  const secret = process.env.BOATLOCAL_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "[boatlocal-booking-status] BOATLOCAL_WEBHOOK_SECRET is not set — refusing all requests",
    );
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const bookingId = new URL(request.url).searchParams.get("booking_id");
  if (!bookingId) {
    return NextResponse.json(
      { ok: false, error: "missing booking_id query param" },
      { status: 400 },
    );
  }

  let status;
  try {
    status = await getBookingOutcomeStatus(bookingId);
  } catch (err) {
    console.error(`[boatlocal-booking-status] lookup threw for ${bookingId}:`, err);
    return NextResponse.json({ ok: false, error: "internal-error" }, { status: 500 });
  }

  if (!status) {
    return NextResponse.json({ ok: true, found: false, bookingId });
  }

  return NextResponse.json({ ok: true, found: true, ...status });
}

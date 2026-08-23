// Vercel Cron -> daily reconciliation of BoatLocal's cruise catalogue (see
// docs/attribution.md's "Reconciliation" section and reconcileBoatLocalCatalog
// in src/lib/data/source.ts). "Webhook-only sync always drifts eventually"
// is BoatLocal's own guidance — this is the belt to the boatlocal-cruise
// webhook's suspenders: it re-fetches the FULL catalogue once a day and
// reconciles whatever the webhooks alone missed (a dropped delivery, a
// webhook Map App was down for, etc.), adding anything missing and hiding
// anything BoatLocal no longer returns.
//
// Protected by a shared secret (CRON_SECRET — this repo had no existing
// cron-style internal endpoint or shared-secret convention to reuse before
// this; grepped for "CRON_SECRET" and similar first), not by HMAC-over-body
// verification the way the webhooks are: this is a GET with no meaningful
// body, called by Vercel Cron rather than by BoatLocal's servers, and Vercel
// Cron has no signing scheme of its own. A bearer-token check is the
// standard pattern for this instead, and is exactly what Vercel's own cron
// docs recommend: when CRON_SECRET is set, Vercel automatically sends
// `Authorization: Bearer <CRON_SECRET>` on its own invocations of this
// route, so this is also naturally satisfied in production with no extra
// configuration beyond setting the env var.

import { NextResponse } from "next/server";
import { reconcileBoatLocalCatalog } from "@/lib/data/source";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[sync-boat-tours] CRON_SECRET is not set — refusing all requests");
    return NextResponse.json({ ok: false, error: "cron not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const result = await reconcileBoatLocalCatalog();
  if (result.error) {
    // Reported, not thrown: reconcileBoatLocalCatalog already guarantees it
    // never wiped out existing data on a failed attempt — this is a 502
    // purely so the failure is visible in Vercel's cron logs, not a signal
    // that anything needs rolling back.
    console.error(`[sync-boat-tours] reconciliation failed: ${result.error}`);
    return NextResponse.json({ ok: false, ...result }, { status: 502 });
  }

  return NextResponse.json({ ok: true, ...result });
}

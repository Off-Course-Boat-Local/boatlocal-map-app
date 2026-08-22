# Booking attribution — design + go-live checklist

Status as of writing: **fully built and tested against dummy data. Not live
yet.** Nothing here needs BoatLocal's real system to exist — it's designed so
that when it does, going live is two environment variables and one message
to BoatLocal's dev team, not a rewrite.

## Why this exists

The guest app hands booking off to boatlocal.nl by URL redirect (PRD §5.5,
§9.4) — no live availability API, no server-to-server call needed for the
booking itself. But the platform-effectiveness metrics (PRD §2.3, §10) need
to know when a booking that came from the map app actually *completed*. A
redirect alone can't tell us that: the guest leaves our app and we have no
way to observe what happens next.

The fix is one webhook, in one direction: **boatlocal.nl tells us** when a
booking tagged with our tracking parameter completes. We never call
boatlocal.nl's API to ask; they call us.

## The flow

```
Guest taps "Book this tour"
        │
        ▼
We mint a click id (bkl_...) and record it
        │
        ▼
Redirect to boatlocal.nl/book?tour=...&ref=<click id>&date=...&guests=...
        │
        ▼
   [ time passes, on boatlocal.nl's side entirely ]
        │
        ▼
Booking completes on boatlocal.nl
        │
        ▼
BoatLocal's system POSTs to our webhook, echoing the click id back
        │
        ▼
We match it to the original click → attribute the booking to a
company + guide + tour, without BoatLocal ever needing to know our
internal model
```

## What BoatLocal's team needs to build (one webhook, one direction)

When a booking that carries our `ref` parameter completes or is cancelled,
`POST` to our webhook URL (TBD once we have a production domain — currently
`/api/webhooks/boatlocal-booking` on whatever host we deploy to):

```
POST /api/webhooks/boatlocal-booking
Content-Type: application/json
X-BoatLocal-Timestamp: 1774627200
X-BoatLocal-Signature: sha256=<hex hmac, see "Signing" below>

{
  "event": "booking.confirmed",
  "click_id": "bkl_9f2a1c...",   // exactly the value we sent as `ref`
  "booking_id": "BL-48213",       // BoatLocal's own id — used for dedup, so it must be stable across retries
  "tour_id": "sunset-canal",
  "guests": 2,
  "amount_cents": 5600,
  "currency": "EUR",
  "booked_at": "2026-08-20T18:00:00Z"
}
```

`event` is `"booking.confirmed"` or `"booking.cancelled"`. Every field above
is required except the payload will still be accepted with `guests`,
`amount_cents`, and `currency` defaulted if omitted — but please send them if
available, that's the whole point of the analytics dashboard.

### Signing (so we know it's really you)

HMAC-SHA256 over `"{timestamp}.{raw request body}"`, using a secret we'll
share out of band (never in code, never in this doc). Send it as:

```
X-BoatLocal-Timestamp: <unix seconds, integer>
X-BoatLocal-Signature: sha256=<hex digest>
```

We reject anything more than 5 minutes old (clock skew in either direction)
to prevent a captured request being replayed later. Sign the *exact bytes*
of the request body — not a re-serialized version of the JSON, since that
can reorder keys and invalidate the signature on our end.

### Retries and idempotency

Retry on anything other than a `2xx`. We dedupe on `booking_id`, so a retried
delivery of the same booking is safe and won't double-count. An unrecognised
`click_id` still gets a `200` — it means we can't attribute the booking, not
that the webhook call failed — so please don't retry on that basis.

## What's real today vs. what's still a placeholder

| Piece | Status |
|---|---|
| Signature verification, replay protection, idempotency | **Real.** `src/lib/attributionWebhook.ts`, fully tested. |
| The webhook route itself | **Real, running.** `src/app/api/webhooks/boatlocal-booking/route.ts` — you can `curl` it today. |
| Click id generation + booking URL builder | **Real.** `src/lib/attribution.ts`. |
| The click actually being recorded anywhere | **Real, as of the guideId-attribution pass.** Previously the click id only ever lived in the redirect URL — nothing recorded it server-side, so even a correctly-signed webhook call would always come back unattributed. Now `guestPinAction()`'s clickId is recorded on the same `boat_book_click` event the guest screens already fire (as `metadata.clickId`), which is also what makes it guide-attributed, not just company-attributed — see `GuestPinAction`'s doc comment in `src/lib/guestActions.ts`. |
| Where attributed bookings are stored | **Real.** `findAttributedClick`/`recordBookingOutcome` in `src/lib/data/source.ts` read/write the real `events` table via the service-role client (RLS blocks `anon` from reading events back, and this caller — BoatLocal's own server — isn't a Studio actor either, so service-role is the correct client here, not a bypass of intent). The old in-memory `attributionStore.ts` is deleted. |
| The exact query param names boatlocal.nl's booking page expects | **Partly confirmed.** `tour`, `ref`, `date`, `guests`, `company` unchanged. `guide` renamed to `distributor` — their codebase has an unrelated "Guides" concept (SEO blog content), and `partner` was already taken by their own affiliate-attribution param. See `buildBookingUrl()` in `src/lib/attribution.ts` — one function, nothing else touches it. |
| The webhook URL's real (production) host | **Placeholder** — depends on where this app deploys. **This is now the actual blocker**: BoatLocal's test-trigger endpoint (once built) fires an outbound POST to whatever URL we give it — `localhost` is unreachable from their servers. Needs at minimum a Vercel preview deployment before the test loop can run for real. |
| The shared signing secret | **Unset.** Generate with `openssl rand -hex 32` when ready — use a distinct one for BoatLocal's test/sandbox environment, never the eventual production secret. |

## What we learned from analyzing boatlocal.nl's real codebase

A feasibility analysis against BoatLocal's actual system (Next.js + Supabase + Stripe, with FareHarbor proxied as a request/response API only — FareHarbor never calls back to BoatLocal) confirmed the load-bearing question directly, with evidence rather than assumption:

**A tracking parameter surviving to a completed booking is not hypothetical — it already happens today, twice.** `?partner=` (affiliate attribution) and Google Ads' `gclid` both follow the exact same three-hop path our `ref` param needs: URL → an Edge middleware cookie → read and re-validated server-side at checkout creation → written onto the `checkouts` row → copied onto the final `bookings` row when the Stripe webhook fires. Our `ref`/`click_id` needs the same plumbing added — a real gap (no column exists for it yet), but not an architectural one.

**`src/lib/google-ads/report-conversion.ts` on their side is close to a direct blueprint** for the production version of this webhook: upsert-with-dedup on a unique key *before* calling the external API (so a Stripe webhook retry can't double-fire), called synchronously right after the booking insert, with a status column for tracking delivery/retry. Our webhook's dedupe-on-`booking_id` is the same idea from the receiving end.

**Real field mapping confirmed**: `bookings.stripe_amount_total`/`stripe_currency` are already integer cents + a currency string — no conversion needed. `total_customers` → `guests`, `item_pk` → `tour_id`, `id` → `booking_id`, `created_at` → `booked_at`.

**No staging database** — BoatLocal isolates test data per-table via a `test_` prefix convention (`test_bookings`, `test_checkouts`), which is exactly the pattern proposed for our own sandbox test.

## See it work right now, with no setup

```bash
npm run dev
curl http://localhost:3000/api/dev/attribution-preview
```

This simulates the entire round trip — mints a click, builds the booking
URL, forges a correctly-signed webhook call exactly as BoatLocal's system
would send it, and shows the resulting attributed record. It 404s outside
development on purpose; it forges signed requests using a dev secret, which
has no business existing in a deployed app.

## Going live — the "one flow" checklist

When BoatLocal's webhook is ready:

1. `openssl rand -hex 32` → set as `BOATLOCAL_WEBHOOK_SECRET` in production
   env, and give BoatLocal's team the same value out of band (Slack DM, not
   email, not a shared doc).
2. Confirm the real query param names for boatlocal.nl's booking page with
   BoatLocal's team; update the four lines in `buildBookingUrl()` if they
   differ from the placeholders above.
3. Give BoatLocal's team the production webhook URL and the payload spec
   above (this file is copy-pasteable as-is).

That's it — the storage layer (`findAttributedClick`/`recordBookingOutcome`
in `src/lib/data/source.ts`) is already real, reading/writing the real
`events` table, so there is no longer a step 4 here to swap it out.

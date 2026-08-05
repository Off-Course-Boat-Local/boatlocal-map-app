You are analyzing boatlocal.nl's own codebase and database to determine whether and how it can support booking attribution for a sister product called the **Boat Local Map App**. This is a research and feasibility task against a real, live business system — investigate thoroughly and answer with evidence (file paths, table/column names, actual code), not guesses. Do not modify, migrate, or deploy anything against production without explicit human review first — see the guardrails at the end.

## Background

The Boat Local Map App is a white-labelled guide a hotel or tour guide hands to guests: a curated map of local recommendations, with a Boat Local canal tour always one tap away. When a guest taps "Book," the map app redirects them to boatlocal.nl with the trip details and a tracking parameter in the URL. That hand-off is a one-way redirect today — the map app has no way of knowing whether a booking it sent actually completed.

That number — bookings that came from the map app and converted — is the entire measure of whether the product is working. Right now it's a placeholder on a dashboard. The fix is a webhook: **boatlocal.nl calls the map app, once, when a booking carrying that tracking parameter completes.** The map app side of this is already built and tested (signature verification, replay protection, idempotency) — what's unknown is whether boatlocal.nl's actual system can support its half.

## What you're being asked to determine

Go into the boatlocal.nl codebase and database and answer the following, with actual evidence:

1. **What handles bookings today?** Framework, language, hosting, database engine. Is it custom-built, a CMS plugin, or a third-party booking platform (FareHarbor, Bokun, Regiondo, etc.)? If it's a third-party platform, check whether it already has a "booking completed" webhook — that could replace most of what's proposed below.

2. **What actually happens to query parameters on the booking URL?** The map app sends `?tour=<id>&ref=<click_id>&date=<date>&guests=<n>&company=<slug>&guide=<slug>`. Trace this through the real booking flow: are these parameters read at all? Do any of them get persisted anywhere against the resulting booking record — a dedicated column, a free-form metadata/notes field, an analytics event, anything? Or are they silently dropped? **This is the single most important question.** If nothing survives to a completed booking, the entire attribution design needs to change before anything else here matters.

3. **What does a real, completed booking record actually contain?** List the actual columns/fields: booking id, tour/product reference, date, guest count, amount, currency, status, customer reference, anything else relevant. This is what an eventual webhook payload would be built from — report the real shape rather than assume it matches what's proposed below.

4. **Does any webhook, callback, or outbound-event infrastructure already exist?** Search for "webhook," "callback," existing outbound HTTP calls fired on booking-confirmed events, a job queue or event bus already wired to booking completion. Building on existing infrastructure is much less work than adding new infrastructure.

5. **Is there a staging/sandbox environment, or any way to test against non-production data?** If not, what would the safest way to add an isolated test table look like, given how the rest of the schema is structured?

## The proposed webhook contract (evaluate this against what you find — do not assume it's correct)

This is what the map app side already implements and expects. Point out precisely where boatlocal.nl's real system would or wouldn't naturally produce this.

```
POST <boatlocal-endpoint-to-be-built>
X-BoatLocal-Timestamp: <unix seconds>
X-BoatLocal-Signature: sha256=<hex hmac of "{timestamp}.{raw request body}", using a shared secret>

{
  "event": "booking.confirmed",       // or "booking.cancelled"
  "click_id": "bkl_9f2a1c...",        // the `ref` param echoed back — the whole attribution mechanism depends on this surviving
  "booking_id": "boatlocal's own booking id",
  "tour_id": "...",
  "guests": 2,
  "amount_cents": 5600,
  "currency": "EUR",
  "booked_at": "2026-08-20T18:00:00Z"
}
```

Signing: HMAC-SHA256 over `"{timestamp}.{body}"`. Requests older than 5 minutes are rejected (replay protection). Retries should happen on anything other than a 2xx; the receiving side dedupes on `booking_id`.

## What to propose, if findings support it

If — and only if — you find that a tracking parameter genuinely can survive to a completed booking, draft a concrete plan for a **test-only** first step:

- A new, fully isolated test table (never the real bookings table) matching the naming/structure conventions already used in this codebase.
- A test-only trigger endpoint that writes a fake booking to that table, then a few seconds later calls the webhook contract above against a **test secret**, distinct from whatever secret would eventually protect a production webhook.
- An optional `"test": true` field in the payload so test-triggered data can be tagged and excluded from real numbers on the receiving side.

Write this as an actual proposed diff — the migration/schema addition, the route/handler code, the outbound call — but do not apply it to any database or deploy it.

## Guardrails

- **Read-only against any real booking, payment, or customer data.** You are here to understand the system, not modify it.
- **Do not run migrations, do not deploy, do not touch production configuration.** If you propose a schema change or new endpoint, present it as a diff/plan for human review — do not apply it yourself.
- **Do not fabricate a shared secret and use it anywhere real.** A placeholder value in a draft is fine; nothing here should be a working credential.
- If anything is ambiguous or you're not confident in what you found, say so explicitly rather than presenting a guess as a fact — the entire point of this investigation is to replace assumptions with ground truth before more code gets written on the map-app side against the wrong shape.

## What to return

A structured written report:
1. Answers to questions 1–5 above, each with the file paths / table names / code evidence you found it from.
2. An explicit verdict on whether a tracking parameter can survive to a completed booking today, and if not, what would need to change.
3. If feasible: the concrete test-endpoint plan from the section above, as a reviewable diff — not applied anywhere.
4. Anything about the real system that means the proposed webhook contract needs to change, and what you'd change it to.

# Booking attribution & cruise-catalogue sync — design + confirmed contract

Status as of writing: **built and unit-tested against a fake store, and
against BoatLocal's own confirmed (but not-yet-live) API contract.** Every
network call this app makes to `boatlocal.nl` is designed to fail gracefully
— BoatLocal's own catalogue endpoint and both webhooks below don't exist on
their side yet, so nothing here has been exercised against their real
servers. This is a coordinated build: both sides are shipping against an
agreed contract, not guessing at each other's APIs.

## Why this exists

The guest app hands booking off to boatlocal.nl by URL redirect (PRD §5.5,
§9.4) — no live availability API, no server-to-server call needed for the
booking itself. But the platform-effectiveness metrics (PRD §2.3, §10) need
to know when a booking that came from the map app actually *completed*, and
which cruise the guest even booked. Two webhooks, both one-directional
(**boatlocal.nl tells us**, we never poll their API for either): one reports
a booking outcome, the other reports a catalogue change.

## Map App is a traffic source, not an affiliate

BoatLocal's own `?partner=` query param is specifically their
payee/commission system (Stripe Connect transfers, monthly invoices) — Map
App is not that, and doesn't use it. Map App's own param names are unchanged
from what this file used to describe as "placeholder": `ref`, `company`,
`distributor`. One new param is added: `src=map-app`, sent on every booking
hand-off so BoatLocal's own analytics can tell this channel apart from
Google Ads (`gclid`) and their own affiliate program without inferring it
from `ref`'s mere presence.

## The booking destination is a cruise-catalogue entry, not a fixed path

`https://boatlocal.nl/book` never existed — it 404s today and always has.
The real destination is a per-cruise page, and Map App gets the exact link
from BoatLocal's own catalogue feed (below) rather than constructing a path
itself. `buildBookingUrl()` (`src/lib/attribution.ts`) reflects this: it no
longer builds a URL from a fixed base + tour id. It takes the tour's own
`bookingUrl` (`BoatTourRecord.bookingUrl` — populated verbatim from
BoatLocal's `booking_url`, see below) and appends tracking params onto it
directly:

```
{booking_url}?date=…&guests=…&src=map-app&ref=<click id>&company=<id>&distributor=<slug, optional>
```

`date`/`guests`/`ref`/`company`/`distributor` semantics are unchanged from
before this change — same names, same optionality (guide/distributor is
optional; a company-level share link omits it). There is no `tour` param any
more: the destination URL is already specific to one cruise.

Three real identifiers exist per cruise on BoatLocal's side, and only two are
URL-safe:

| Field | Routable? | Use |
|---|---|---|
| `id` (BoatLocal's internal PK) | **Never — always 404s.** | Stored as `boat_tours.boatlocal_id`, reference/dedup only. Never used to build a URL. |
| `fareharbor_pk` | Yes (301s to the slug URL) | `boat_tours.fareharbor_pk` — the sync/reconciliation upsert key. |
| `slug` | Yes, canonical | `boat_tours.slug` — reference/display. |

## The cruise-catalogue feed

`GET /api/public/cruises` (no auth, no date param — **does not exist yet on
BoatLocal's side**) returns every currently-active cruise:

```json
{
  "cruises": [
    {
      "id": 1,
      "fareharbor_pk": 85146,
      "slug": "shared-old-city-center-boat-tour",
      "name": "Amsterdam Boat Tour of the Old City Center",
      "cruise_type": "shared",
      "cruise_duration": "1 hour & 30 mins",
      "starting_price": 29,
      "currency": "EUR",
      "max_participants": 12,
      "company_shortname": "offcourse",
      "images": ["https://…"],
      "booking_url": "https://boatlocal.nl/cruise/shared-old-city-center-boat-tour",
      "active": true,
      "updated_at": "2026-08-23T09:00:00Z"
    }
  ],
  "generated_at": "2026-08-23T12:00:00Z",
  "count": 111
}
```

Map App's consumer of this (`src/lib/boatlocalCatalog.ts`'s
`parseBoatLocalCruise`, and `src/lib/data/source.ts`'s
`syncCruiseFromBoatLocal`/`reconcileBoatLocalCatalog`) is built now so it
starts working the moment BoatLocal ships their side. A failed fetch (network
error or non-2xx) is reported via an `error` field and leaves the existing
catalog completely untouched — it never throws, and never wipes out working
data on a bad attempt.

**JUDGMENT CALL, worth knowing about**: the feed has no lat/lng, no
departure-point "area", and no guide-written "note" — fields `boat_tours`
still requires for every row (admin-curated or BoatLocal-sourced alike). A
brand-new cruise from the feed is inserted with empty placeholders for those
(`area: ""`, `lng`/`lat`: `0,0`, `note: ""`) and forced to `status: 'hidden'`
**regardless of BoatLocal's own `active` flag**, until an admin opens it in
BoatTourForm and fills in the real location/description — otherwise a live
"Book this tour" pin would sit at `(0,0)` unattended. This hidden-pending-
completion state is **sticky**: it survives every subsequent sync (including
the daily reconciliation) until an admin actually saves real values — a
naive one-time gate would get silently undone by the very next scheduled
sync, since that sync has no way to know the row is still incomplete other
than checking whether `area` is still empty.

Once an admin has completed a BoatLocal-sourced row, `status` is driven by
BoatLocal's `active` flag on every subsequent sync — BoatLocal becomes that
row's source of truth for identity/pricing (name, price/duration, photos,
booking URL, active/hidden), while location/description/catalog-position stay
Map App's own curation layer, never touched by a sync pass once set.

### Catalogue webhooks

Same signing scheme as the booking webhook (see below), new event names, on
a **separate route**
(`src/app/api/webhooks/boatlocal-cruise/route.ts`) since it's a different
concern with no click/attribution context at all:

```json
{ "event": "cruise.activated", "cruise": { /* same shape as one catalogue entry above */ }, "occurred_at": "2026-08-23T14:05:00Z" }
```
```json
{ "event": "cruise.deactivated", "cruise": { "id": 1, "slug": "…", "fareharbor_pk": 85146 }, "reason": "removed_from_fareharbor", "occurred_at": "2026-08-24T03:02:00Z" }
```

`reason` is `"admin_disabled"` or `"removed_from_fareharbor"` — stored as
plain data (`boat_tours.deactivation_reason`), no behavior branches on it.
**Open question, not answered here**: whether Map App should ever treat the
two reasons differently (e.g. hide vs. fully remove). Don't invent an answer;
this is a live discussion between the two teams.

Any other `event` value (e.g. a proposed-but-not-agreed `cruise.updated`, for
price/name/image drift outside a full sync) is accepted with `200` and
no-op'd, never rejected — so BoatLocal adding an event type later needs no
route change here and never causes their side to retry forever over
something Map App simply hasn't built handling for yet.

**Expect bursts, not one-at-a-time delivery**: BoatLocal's own daily 03:00
UTC FareHarbor sync can deactivate many cruises in a single automated run
with zero human involvement.

### Reconciliation (webhook-only sync always drifts)

`GET /api/cron/sync-boat-tours`, protected by a `CRON_SECRET` bearer-token
check (this repo had no prior cron-style endpoint or shared-secret
convention to reuse — `BOATLOCAL_WEBHOOK_SECRET` is HMAC-over-body, which
doesn't apply to a bodyless GET from Vercel Cron rather than from BoatLocal's
servers). Runs once daily (`vercel.json`'s `crons` entry, `30 3 * * *` UTC —
scheduled just after BoatLocal's own 03:00 UTC FareHarbor sync, so it reads
settled results) and calls `reconcileBoatLocalCatalog()`: re-pulls the FULL
catalogue, upserts everything returned, and hides any BoatLocal-sourced row
(`fareharbor_pk is not null`) the feed no longer returns
(`deactivation_reason: 'removed_from_fareharbor'`). If the feed returns zero
usable cruises — empty response or an unparseable shape — this deliberately
does **not** run the "hide missing" step, to avoid mass-deactivating the
whole real catalog on a fluke; it reports an error instead.

## Booking-outcome webhook (unchanged route, extended payload)

When a booking that carries our `ref` parameter completes or is cancelled,
BoatLocal `POST`s to:

```
POST /api/webhooks/boatlocal-booking
Content-Type: application/json
X-BoatLocal-Timestamp: 1774627200
X-BoatLocal-Signature: sha256=<hex hmac, see "Signing" below>

{
  "event": "booking.confirmed",
  "click_id": "bkl_9f2a1c...",
  "booking_id": "BL-48213",
  "tour_id": "sunset-canal",
  "guests": 2,
  "amount_cents": 5600,
  "currency": "EUR",
  "booked_at": "2026-08-20T18:00:00Z",
  "source": "map-app",
  "source_company": "11111111-1111-1111-1111-111111111111",
  "source_distributor": "22222222-2222-2222-2222-222222222222",
  "cruise_slug": "shared-old-city-center-boat-tour",
  "cruise_fareharbor_pk": 85146
}
```

`event` is `"booking.confirmed"` or `"booking.cancelled"` — **there is no
third "rebooked" event**. BoatLocal's own `/api/booking/modify` rebook flow
already decomposes into a `booking.cancelled` (the old booking id) followed
by a `booking.confirmed` (the new booking id); Map App doesn't need a
combined event type to represent that, and doesn't need to correlate a
rebook's amount specially — the two independent bookingIds already flow
through the exact same dedup/attribution/netting logic every other
confirmed/cancelled pair does.

`source`/`source_company`/`source_distributor`/`cruise_slug`/
`cruise_fareharbor_pk` are new, all optional — BoatLocal may not send them
immediately, and `parseBookingWebhookPayload` treats each as `undefined`
(not defaulted) when absent.

### Fallback attribution

`recordBookingOutcome` (`src/lib/data/source.ts`) first tries the normal
click-id lookup (`findAttributedClick`). If that comes up empty — the click
record expired, or click tracking never fired for this booking — but the
payload echoes `source_company` (and optionally `source_distributor`), those
are used instead of leaving the booking fully unattributed. This is safe to
trust despite being caller-supplied data: the whole payload is already
HMAC-verified by the time this runs, so the risk isn't spoofing, it's a
stale/typo'd id — which is why `resolveFallbackAttribution` still resolves
each one against a real `companies`/`guides` row before trusting it into a
foreign key, rather than inserting blind.

**Judgment call**: an unresolvable `source_company` means no fallback at all
(the booking stays unattributed). An unresolvable `source_distributor` under
an otherwise-valid company only drops the guide half — the booking still
attributes to the company, the same "company-level, no specific guide" shape
a real company-wide share link's click already produces.

### Cancellation nets against its matching confirmation

A `booking.cancelled` for a `booking_id` that was already `booking.confirmed`
is now recorded as its own second event (previously, deduping purely on
`booking_id` meant a genuine cancellation was silently dropped as if it were
a duplicate delivery of the confirmation — a real bug, fixed alongside this).
Every "tours booked"/conversion-rate metric that sums the `booking_outcome`
event type nets a cancellation against its confirmation instead of letting
it inflate the count: +1 for confirmed, −1 for cancelled, summed per group —
a `Postgres` migration
(`20260823210000_net_cancelled_booking_outcomes.sql`) implements this in the
real `company_analytics_summary`/`guide_analytics_summary`/
`admin_platform_analytics` RPCs, and `src/lib/data/source.ts`'s fakeStore
branches of the same three functions mirror it by hand so the test suite
actually exercises it.

### Booking data is admin-only

Booking financial/outcome data (real `amount_cents`, `currency`,
`booking_id`, confirmed/cancelled status) is visible to admin only — a
company or guide never sees a `booking_outcome` row, in Studio or anywhere
else. This is enforced at the RLS layer
(`20260823220000_restrict_booking_outcome_events_rls.sql` restricts
`company_select_own_events`/`guide_select_own_events` to exclude
`event_type = 'booking_outcome'`; every other event type — `app_open`,
`tip_saved`, `boat_book_click`, etc. — is unaffected), with a matching by-hand
exclusion in `source.ts`'s fakeStore branches of
`getCompanyAnalyticsSummary`/`getGuideAnalyticsSummary` (the fake store has
no RLS of its own to fall back on). Studio's own "Tours booked" company
dashboard KPI is removed entirely, not just zeroed.

### Signing (unchanged, shared by both webhooks)

HMAC-SHA256 over `"{timestamp}.{raw request body}"`, using a secret shared
out of band (never in code, never in this doc):

```
X-BoatLocal-Timestamp: <unix seconds, integer>
X-BoatLocal-Signature: sha256=<hex digest>
```

Rejected if more than 5 minutes old (clock skew in either direction), to
prevent a captured request being replayed later. Signed over the *exact
bytes* of the request body — not a re-serialized version of the JSON, since
that can reorder keys and invalidate the signature on our end. Both
`boatlocal-booking` and `boatlocal-cruise` reuse the exact same verification
code (`src/lib/attributionWebhook.ts`) — there is only one implementation of
this, never two.

### Retries and idempotency

Retry on anything other than a `2xx`. Booking outcomes dedupe on
(`booking_id`, `event`) — not `booking_id` alone, see above. An unrecognised
`click_id` still gets a `200` (unattributable, not a webhook failure). A
cruise-catalogue event for a cruise Map App has never synced is also a
silent `200` no-op, for the same reason.

## What's real today vs. what's still a placeholder

| Piece | Status |
|---|---|
| Signature verification, replay protection, idempotency | **Real.** `src/lib/attributionWebhook.ts`, shared by both webhook routes. |
| Both webhook routes | **Real, running.** `src/app/api/webhooks/boatlocal-booking/route.ts` and `.../boatlocal-cruise/route.ts` — curl either today. |
| Click id generation + booking URL builder | **Real**, updated to append onto the tour's own `bookingUrl` rather than a fixed base. `src/lib/attribution.ts`. |
| Cruise-catalogue sync (webhook + daily reconciliation) | **Real**, built against BoatLocal's confirmed-but-not-yet-live contract. `src/lib/data/source.ts`'s `syncCruiseFromBoatLocal`/`reconcileBoatLocalCatalog`/`deactivateBoatLocalCruise`. |
| Fallback attribution via `source_company`/`source_distributor` | **Real**, with real existence validation before trusting either id. |
| Cancellation netting | **Real**, at both the SQL and fakeStore layers. |
| Booking data admin-only | **Real**, enforced at RLS. |
| The query param names boatlocal.nl's booking page expects | **Confirmed.** `ref`, `date`, `guests`, `company`, `distributor`, `src` — see `buildBookingUrl()` in `src/lib/attribution.ts`. |
| `GET /api/public/cruises`, `cruise.activated`/`cruise.deactivated` webhooks | **Do not exist yet on BoatLocal's side.** Map App's consumer is built and tested against the agreed contract so it starts working the moment BoatLocal ships theirs. |
| The webhook URLs' real (production) host | **Placeholder** — depends on where this app deploys. A Vercel preview/production deployment is needed before either webhook can be triggered by BoatLocal's real servers (`localhost` is unreachable from theirs). |
| The shared signing secret | **Unset.** Generate with `openssl rand -hex 32` when ready — use a distinct one for BoatLocal's test/sandbox environment, never the eventual production secret. Same secret verifies both webhook routes. |
| `CRON_SECRET` | **Unset.** Any value works locally; set a real one in Vercel before the cron job goes live (Vercel sends it automatically as a bearer token once the env var exists). |

## What's still genuinely open (not placeholders — these have been asked, and remain unanswered)

- **`removed_from_fareharbor` vs. `admin_disabled`**: whether Map App should
  ever behave differently based on a cruise-deactivation reason (e.g. hide
  vs. fully remove). Stored as data; no behavior built on it yet.
- **`cruise.updated`**: proposed by BoatLocal for price/name/image drift
  outside a full catalogue re-sync, not yet agreed. The webhook route
  already accepts-and-no-ops any event it doesn't recognise, so adding this
  later needs no route change — but no handling logic exists for it today.

## See it work right now, with no setup

```bash
npm run dev
curl http://localhost:3000/api/dev/attribution-preview
```

This simulates the booking round trip — mints a click, builds a booking URL
against a stand-in tour `bookingUrl`, forges a correctly-signed webhook call
exactly as BoatLocal's system would send it, and shows the resulting
attributed record. It 404s outside development on purpose; it forges signed
requests using a dev secret, which has no business existing in a deployed
app.

## Going live — the remaining checklist

1. `openssl rand -hex 32` → set as `BOATLOCAL_WEBHOOK_SECRET` in production
   env, and give BoatLocal's team the same value out of band (Slack DM, not
   email, not a shared doc). Verifies both webhook routes.
2. Set `CRON_SECRET` in production env (any strong random value — Vercel
   attaches it automatically as a bearer token to its own cron invocations
   once set).
3. Confirm the production webhook URLs with BoatLocal's team for both
   `/api/webhooks/boatlocal-booking` and `/api/webhooks/boatlocal-cruise`,
   and give them the payload specs above (this file is copy-pasteable).
4. Once BoatLocal ships `GET /api/public/cruises` for real, optionally set
   `BOATLOCAL_CATALOG_BASE_URL` if it differs from `https://boatlocal.nl`
   (e.g. a staging host first) — otherwise no code changes are needed; the
   cron job and both webhooks are already built against the agreed shape.

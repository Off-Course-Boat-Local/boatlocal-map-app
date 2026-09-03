# Outreach research — the funnel-refill routine

The contract between the weekly research routine (a Claude Code cloud
routine, not app code) and the two endpoints it calls. Read alongside
[outreach-voice.md](./outreach-voice.md), which governs how the emails this
funnel eventually sends are written — this doc only covers how prospects
get INTO the tracker.

## The one rule

**Facts come from Google Places. Judgment comes from the routine. Sending
comes from a human, later, through the tracker's own compose box.**

`GET /api/admin/outreach/candidates` returns candidates with every
Places-sourced field already filled in — name, website, phone, rating,
review count, Google place id — and every objectively-decidable reject
already applied (see below). The routine never invents a number or a URL.
What it adds is the part that needs reading a website: is this actually
independent (a subtler chain affiliation a name-match can't catch), who to
contact, whether an email is genuinely published, one line of "why this
one". A prospect with no discoverable email is still worth adding — the
tracker already handles that ("log a call instead").

The routine never sends email, posts to Slack directly, or touches the
repository. It only calls the two endpoints below.

## `GET /api/admin/outreach/candidates`

`Authorization: Bearer $OUTREACH_IMPORT_SECRET`

| Param | Values | Default |
|---|---|---|
| `segment` | `hotel` \| `operator` (required) | — |
| `limit` | integer, capped at 40 | 25 (hotel), 10 (operator) |

Runs Google Places Text Search (New) against a segment-specific query set —
hotel queries rotate 4 of 10 Amsterdam-area neighbourhoods per ISO week so
the same ten aren't searched every time; operator queries are fixed
(walking/bike/food tours, bike rental). See
[`outreachQualification.ts`](../src/lib/admin/outreachQualification.ts) for
the exact lists — this doc describes the contract, that file is the source
of truth if they ever disagree.

**Rejected before the routine ever sees them** (all mechanical, from
Google's data or our own tables — no judgment call):

| Reason | What it means |
|---|---|
| `already_known` | Matches an existing prospect by Google place id, website domain, or name — or matches a `companies` row by name (best-effort; no shared key) |
| `not_operational` | Google's own `businessStatus` isn't `OPERATIONAL` |
| `no_website` | No `websiteUri` on the Places result — nothing for the routine to read |
| `low_rating_or_reviews` | Below the segment threshold: hotels ≥4.0★/≥50 reviews, operators ≥4.5★/≥100 reviews |
| `chain` | Hotel name matches an obvious chain-brand marker (Marriott, Hilton, IHG, Accor, NH, Radisson, citizenM, …) — name-only, so a subtler affiliation still needs the routine to catch it by reading the site |
| `wrong_type` | Operator only: BoatLocal's own catalogue sync already covers boat/canal tours, so those are excluded here; results with none of walking/bike/food/museum/sightseeing in their Places types are dropped too |

Response:

```json
{
  "segment": "hotel",
  "queriesRun": ["hotels in Jordaan, Amsterdam", "..."],
  "candidates": [
    {
      "googlePlaceId": "ChIJ...",
      "name": "Hotel V Nesplein",
      "address": "Nes 49, 1012 KD Amsterdam",
      "website": "hotelvnesplein.com",
      "phone": "+31 20 662 3233",
      "rating": 4.7,
      "reviewCount": 2140,
      "types": ["lodging", "hotel"],
      "primaryType": "hotel",
      "businessStatus": "OPERATIONAL",
      "segment": "hotel"
    }
  ],
  "rejected": { "already_known": 3, "not_operational": 0, "low_rating_or_reviews": 9, "chain": 7, "wrong_type": 0, "no_website": 2 },
  "rejectedTotal": 21
}
```

For each **kept** candidate, the routine visits `website` and decides:

- **Keep or reject**, with a one-line reason if rejecting (subtler chain
  affiliation not visible from the name, clearly not independent, a
  duplicate the mechanical check missed).
- **Contact name** — only if a real person is named (owner, GM, marketing
  contact). A "Team" or department name isn't a contact — see
  `outreachDraft.ts`'s own `firstName()` for why that's treated as nobody.
- **Contact email** — only if it's published. Write the page it came from
  in Notes. **Never guess an address pattern** (`info@`, `hello@`,
  `firstname@`). A blank email is correct and expected; it's more common
  than not for a small operator.
- **One line of context** for the eventual first email — what they do
  well, their guest type, anything `outreachDraft.ts`'s fact-line logic
  could use if the rating/review data alone isn't enough.

### Where to look for the owner

The homepage almost never names anyone. In order, stopping as soon as a
real person is found:

1. **The site's own contact/about pages** — `/contact`, `/about`,
   `/about-us`, `/team`, and the Dutch equivalents `/over-ons`,
   `/contact-ons`. Follow the site's own nav rather than only guessing
   paths; a 404 on a guessed path means nothing.
2. **One web search**, only if the site named nobody:
   `"<business name>" Amsterdam (owner OR founder OR eigenaar) LinkedIn`.
   A LinkedIn or press result establishes a **name and role** — that's all
   it's for.
3. **Stop there.** LinkedIn does not publish email addresses, and neither
   does the KVK register; nothing found in step 2 may ever become an
   `Email` value. A name with a blank email is a good outcome — the first
   email opens "Hi Priya," instead of "Hi," which is the whole point, and
   the tracker's call flow covers the rest.

Two hard limits, both because a wrong specific is worse than a blank
field: **never infer an address from a pattern**, and **never attribute a
name to a business unless the source explicitly ties them together** (a
"Priya" who runs a different Amsterdam hotel is not this hotel's owner).

## `POST /api/admin/outreach/import`

`Authorization: Bearer $OUTREACH_IMPORT_SECRET`, `multipart/form-data`.

| Field | Required | Notes |
|---|---|---|
| `file` | yes | CSV, same columns as [`scripts/data/amsterdam-tour-operators.csv`](../scripts/data/amsterdam-tour-operators.csv), plus the ones below |
| `segment` | no | Default segment for rows with no `Segment` column value. Defaults to `operator`. |

CSV columns beyond the original set (all optional — a file with none of
these still imports exactly as before):

| Column | Maps to |
|---|---|
| `Segment` | `operator` \| `hotel` \| `agency`, per-row — lets one file mix hotels and operators. Falls back to the `segment` form field, then to `operator`. |
| `Google Place ID` | `google_place_id` — carry this over from the candidates response so a re-import of the same place is recognized as an update, not a duplicate |

Every row imported through this endpoint is tagged `source: "agent"`
regardless of who actually calls it — that tag means "came in via the API,"
which is what makes the admin list's "N new this week" badge (rows with
`source = 'agent'` created in the last 7 days) meaningful. Upserts on
`name` — same non-destructive contract as the original script: only
enrichment columns are ever written, status/next-action/company_id on an
existing row are never touched.

On success, posts one line to `SLACK_OUTREACH_WEBHOOK_URL` (if configured):
`Research: 25 hotels, 10 operators added (32 new, 3 updated) · 2 excluded`.

## Running it by hand

```bash
curl -s https://map.boatlocal.nl/api/admin/outreach/candidates?segment=hotel \
  -H "Authorization: Bearer $OUTREACH_IMPORT_SECRET" | jq

curl -s -X POST https://map.boatlocal.nl/api/admin/outreach/import \
  -H "Authorization: Bearer $OUTREACH_IMPORT_SECRET" \
  -F "file=@research.csv" -F "segment=hotel"
```

## Open decisions

Left to the person running this, not encoded as a rule:

- **Chains** are rejected outright right now. If a later campaign wants to
  pitch a chain's regional office differently, that's a new segment and a
  new draft in `outreachDraft.ts`, not a change to this filter.
- **Weekly quota** (25 hotels / 10 operators) assumes ~30 first emails
  actually get sent a week. If the real send rate is lower, lower
  `DEFAULT_LIMIT` in `route.ts` — a backlog of unsent, un-skimmed
  candidates goes stale the same way a stale list does.
- **Neighbourhood list** is inside the A10 plus Oost/Rivierenbuurt. Whether
  to add Zuidas/Amstelveen business hotels depends on whether their guests
  are the ones who'd open a lobby QR for "things to do nearby."

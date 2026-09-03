# Outreach voice — how we write to prospects

The rules behind `src/lib/admin/outreachDraft.ts`, and the brief for anyone
(human or model) drafting a partner email on Map App's behalf. Written so it
can be pasted as-is into a system prompt.

The point of an outreach email is to start a conversation, not to close one.
Every rule below serves that.

## What the data says (why these rules exist)

- Under 80 words gets ~42% more replies than over 150 (Hunter, 8.2M emails).
  Lavender's 4.5M-email set puts the sweet spot at 25–50 words, 75 max.
- 3rd–5th grade reading level gets 67% more replies than 10th+ (Lavender).
  Short words, short sentences, one idea per line.
- One call to action beats two or more by 37% (Lavender).
- A yes/no question outperforms "got 30 minutes Tuesday?" — asking for time
  is the highest-friction ask there is (Braun).
- Follow-ups roughly double total replies: 4.1% → 8.3% with 3–5 steps
  (Woodpecker, 20M emails). The first follow-up is usually the single best
  performing email in the sequence. Past six touches, replies fall off and
  sender reputation suffers.
- Each follow-up must add one new thing. Repeating the first email, or
  "just checking in", is the pattern that gets marked as spam.
- Space follow-ups unevenly (3–4 days, then 5–7, then 7–10). Identical
  intervals read as automation.
- Advanced personalisation roughly doubles reply rate vs. name-only
  (17–18% vs 7–9%, Woodpecker). "Personalised" means a fact about *them*
  that proves you looked, in the first line.
- Dutch B2B: direct, factual, 3–5 sentences, no warm-up, no softening.
  Automated-sounding email is ignored on sight.

## The offer, stated plainly

Map App is a free guest-discovery app hotels put on a lobby QR. Guests open
it to find things to do nearby. A tour operator listed in it is put in front
of guests of every hotel on the platform. No listing fee, no commission taken
from the operator's booking — Map App exists to send traffic, not to take a
cut.

For a **tour operator**, the pitch is distribution: hotel guests, at the
moment they're deciding what to do today, without paying an OTA 20–30%.

For a **hotel**, the pitch is a gift: a branded guest app for free, with your
own recommendations in it.

Lead with what they get. Never open with who we are.

## Structure

### First email (touch 1) — 40–80 words

1. **Their fact, not ours.** One line that could only have been written to
   them: their rating and review count, their tour type, their languages,
   how long they've been running. State it; don't gush about it.
2. **The offer in one sentence,** built on the "without" formula:
   *(what they get) without (the thing that currently costs them)*.
   Example: "guests of Amsterdam hotels, without an OTA taking 25%."
3. **How it works in one line,** concrete: a lobby QR, a guest opens it,
   your tour is one of the ones they see.
4. **One yes/no question.** "Worth a look?" / "Open to hearing how it
   works?" / "Is this of interest?" Never a meeting request.
5. **Sign-off:** first name, company. No title block, no banner.

Subject: 1–3 words, title case, no punctuation, no name, no verb.
"Hotel Guests" / "Amsterdam Guests". Keep the identical subject on every
follow-up so mail clients thread them.

### Follow-up 1 (touch 2, ~4 days later) — 25–50 words

One new angle, not a repeat. Pick one:
- A number: how many hotels/guests are on the platform now, or the
  book-click → booking conversion we measure.
- A concrete example: a comparable operator already listed.
- A sharper "without": what they keep doing if nothing changes (the cost of
  inaction — "poke the bear"), phrased as a neutral question, not a threat.

Then the same one-line yes/no CTA. Do not summarise the first email. Do not
say "following up", "circling back", "bumping this", or "just checking in".

### Follow-up 2 (touch 3, ~5–7 days later) — 15–30 words

The detach email. One neutral question that lets them close the loop with a
one-word answer, Chris Voss style: "Have you decided against listing
[name] for now?" / "Is this shelved on your end?" A "no" here is a win —
it's a reply.

After touch 3, the tracker schedules a call. No touch 4 by email.

## Banned — these read as machine-written or as commission breath

Openers: "I hope this finds you well", "I hope you're doing well", "I'm
reaching out", "I wanted to reach out", "My name is", "I'm [name] from".
Filler: "just", "genuinely", "truly", "really", "quick question" (as a
subject), "touching base", "circling back", "following up on my previous
email", "as mentioned", "I'd love to", "we'd love to", "feel free to".
Jargon: "leverage", "synergy", "streamline", "optimize", "solution",
"cutting-edge", "seamless", "unlock", "empower", "elevate", "robust",
"ecosystem", "referral channel", "commission stack".
Hype: "exciting", "amazing", "incredible", "game-changer", "no-brainer",
"win-win", exclamation marks.
Model tells: "delve", "landscape", "tapestry", "testament", "pivotal",
"showcase", "vibrant", "foster", "enhance", "crucial"; the pattern
"not just X, but Y"; three-item lists for rhythm; a summarising last line;
an em dash in every paragraph.
Asks: "Do you have 15/30 minutes", "Can we hop on a call", "Let's set up a
time", any calendar link in touch 1.

## Do

- Write to one person. If we have a first name, use it once, at the top.
- Use their words: "guests", "tours", "bookings", "the lobby", "the season".
  Not "distribution channel" or "guest-discovery platform".
- Numbers as numbers: "4.5 stars, 16,096 reviews", "12 hotels", "24%".
- Let a sentence be short. Vary the next one.
- End on a plain, warm line if there is one to give — "Either way, the
  reviews speak for themselves" — or on the question. Never on a pitch.
- Read it aloud once. Anything you wouldn't say across a table, cut.

## What a good first email looks like

> Subject: Hotel Guests
>
> Hi Anja,
>
> 16,096 reviews at 5 stars and seven languages — few walking tours in
> Amsterdam are set up as well for hotel guests as 360.
>
> Map App is the free app hotels put on a lobby QR so guests can find what
> to do nearby. Operators listed in it reach those guests without an OTA
> taking 25% of the booking.
>
> Is that worth a look?
>
> Beer, Map App

52 words. One fact about them, one offer with a "without", one line on the
mechanism, one yes/no question.

// Prefill text for the outreach compose box (OutreachComposeForm.tsx) —
// deliberately a plain function, not a template rendered server-side and
// sent as-is: this is a FIRST DRAFT the admin is expected to read and
// personalise per prospect before hitting send, not a canned blast. Kept
// out of src/lib/email/templates.ts on purpose — that file renders emails
// that actually go out; this only ever feeds a <textarea>'s defaultValue.
//
// The rules this follows — word counts, the "without" formula, one yes/no
// question, a different angle per touch, the banned-phrase list — are in
// docs/outreach-voice.md with the data behind each. outreachDraft.test.ts
// enforces the mechanical ones so a future edit can't quietly drift back to
// "I hope this finds you well". Read the doc before changing the copy.
//
// One draft per TOUCH, not one draft reused: the first email, the first
// follow-up and the last follow-up each do a different job (open, add one
// new angle, let them close the loop), and a follow-up that repeats the
// first email is the single pattern most likely to get us marked as spam.

import type { OutreachProspect } from "@/lib/data/outreach";

/** 1 = first email, 2 = first follow-up, 3 = last (detach) follow-up. */
export type OutreachTouch = 1 | 2 | 3;

export interface OutreachDraft {
  subject: string;
  body: string;
  touch: OutreachTouch;
}

/**
 * Which touch comes next, from how many emails have already gone out —
 * counted from the event log (the detail page already loads it), so there
 * is one source of truth for "how many times have we emailed them", same
 * as sendOutreachEmailAction's own cadence logic.
 */
export function outreachTouchForPriorEmails(priorEmails: number): OutreachTouch {
  if (priorEmails <= 0) return 1;
  if (priorEmails === 1) return 2;
  return 3;
}

/**
 * Identical on every touch on purpose: Gmail/Outlook thread on subject +
 * participants, so the follow-up lands under the first email instead of as
 * a fresh unread cold email. 1–3 words, no punctuation, no name, no verb.
 */
const SUBJECT = "Hotel Guests";

const SIGN_OFF = "Beer, Map App";

function firstName(prospect: OutreachProspect): string | null {
  const first = prospect.contactName?.trim().split(/\s+/)[0];
  if (!first) return null;
  // "SANDEMANs Team" / "Team" style contact names aren't a person.
  if (/^team$/i.test(first) || /team$/i.test(prospect.contactName ?? "")) return null;
  return first;
}

function greeting(prospect: OutreachProspect): string {
  const first = firstName(prospect);
  return first ? `Hi ${first},` : "Hi,";
}

/** "bike tours" / "walking tours" / "food tours" / "tours" — their word, not ours. */
function tourWord(prospect: OutreachProspect): string {
  const type = (prospect.tourType ?? "").toLowerCase();
  if (type.includes("bike") || type.includes("bicic")) return "bike tours";
  if (type.includes("food")) return "food tours";
  if (type.includes("walk")) return "walking tours";
  if (type.includes("boat") || type.includes("canal")) return "boat tours";
  return "tours";
}

function languageCount(prospect: OutreachProspect): number {
  if (!prospect.languages) return 0;
  return prospect.languages
    .split(/[,/]/)
    .map((l) => l.trim())
    .filter(Boolean).length;
}

const NUMBER_WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
function countWord(n: number): string {
  return n >= 1 && n <= 9 ? NUMBER_WORDS[n] : String(n);
}

function formatRating(rating: number): string {
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

/**
 * The one line that proves we looked. Built only from fields that are
 * actually filled in — a prospect with no enrichment gets NO fact line
 * rather than a vague compliment, because an invented specific is worse
 * than none. Operators get TripAdvisor-flavoured phrasing (their own
 * customers' reviews of THEIR tours); hotels get the same rating/review
 * fields (Google's, for a hotel — see the migration's own column comment)
 * phrased as a stay, not a tour.
 */
function theirFact(prospect: OutreachProspect): string | null {
  const reviews = prospect.taReviewCount;
  const rating = prospect.taRating;

  if (prospect.segment === "hotel") {
    if (reviews && rating) {
      return `${reviews.toLocaleString("en-GB")} reviews at ${formatRating(rating)} stars — guests clearly leave ${prospect.name} happy.`;
    }
    return null;
  }

  const langs = languageCount(prospect);
  const tours = tourWord(prospect);
  if (reviews && rating && langs >= 3) {
    return `${reviews.toLocaleString("en-GB")} reviews at ${formatRating(rating)} stars and ${countWord(langs)} languages — few ${tours} in Amsterdam are set up as well for hotel guests as ${prospect.name}.`;
  }
  if (reviews && rating) {
    return `${reviews.toLocaleString("en-GB")} reviews at ${formatRating(rating)} stars — guests clearly leave ${prospect.name} happy.`;
  }
  if (prospect.yearFounded) {
    return `Running ${tours} in Amsterdam since ${prospect.yearFounded} says enough about how they land.`;
  }
  return null;
}

/**
 * The offer sentence, per segment — an operator gets distribution (the
 * "without" is the OTA cut); a hotel gets a gift (the "without" is any
 * cost or upkeep). See docs/outreach-voice.md "The offer, stated plainly".
 */
function offerSentence(prospect: OutreachProspect): string {
  return prospect.segment === "hotel"
    ? "Map App is a free guest-discovery app — a QR code in your lobby, and guests get curated recommendations for exploring Amsterdam, without your team maintaining anything."
    : "Map App is the free app hotels put on a lobby QR so guests can find what to do nearby. Operators listed in it reach those guests without an OTA taking 25% of the booking.";
}

/** Touch 1: their fact, the offer with a "without", one yes/no question. */
function firstEmail(prospect: OutreachProspect): string {
  const fact = theirFact(prospect);
  return [
    greeting(prospect),
    "",
    ...(fact ? [fact, ""] : []),
    offerSentence(prospect),
    "",
    "Is that worth a look?",
    "",
    SIGN_OFF,
  ].join("\n");
}

/**
 * Touch 2: ONE new angle, then the same question. Never a recap of touch 1.
 * Operator angle is the cost of doing nothing — if we know they sell
 * through OTAs it names that, otherwise it asks how hotel guests find them
 * today. Hotel angle is the same "poke the bear" shape, aimed at their
 * guests' first day instead of a booking channel.
 */
function firstFollowUp(prospect: OutreachProspect): string {
  if (prospect.segment === "hotel") {
    const angle = `Most guests at ${prospect.name} spend their first afternoon figuring out what to do before anyone at the front desk gets asked.`;
    return [greeting(prospect), "", angle, "", "Worth a look?", "", SIGN_OFF].join("\n");
  }

  const notes = prospect.notes ?? "";
  const otaMatch = notes.match(/\b(Viator|GetYourGuide|Klook|Tiqets|Airbnb)\b/i);
  const angle = otaMatch
    ? `Every booking that comes through ${otaMatch[1]} costs ${prospect.name} 20–30%. Hotel guests who find you in Map App book with you directly.`
    : `Most hotel guests who haven't planned their day yet have no obvious way to find ${prospect.name}.`;

  return [greeting(prospect), "", angle, "", "Worth a look?", "", SIGN_OFF].join("\n");
}

/**
 * Touch 3: the detach email. One neutral question they can answer in a
 * word. A "no" is a reply, which is more than silence — and it lets the
 * tracker close them out instead of scheduling a call into a void.
 */
function lastFollowUp(prospect: OutreachProspect): string {
  return [
    greeting(prospect),
    "",
    `Have you decided against listing ${prospect.name} on Map App for now?`,
    "",
    "A one-word answer is fine either way.",
    "",
    SIGN_OFF,
  ].join("\n");
}

export function buildDefaultOutreachDraft(
  prospect: OutreachProspect,
  options: { touch?: OutreachTouch } = {},
): OutreachDraft {
  const touch = options.touch ?? 1;
  const body = touch === 1 ? firstEmail(prospect) : touch === 2 ? firstFollowUp(prospect) : lastFollowUp(prospect);
  return { subject: SUBJECT, body, touch };
}

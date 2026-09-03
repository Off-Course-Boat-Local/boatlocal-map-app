// Affiliate outreach — the mechanical half of candidate qualification for
// /api/admin/outreach/candidates (docs/outreach-research.md). Everything
// here can be decided from Google's own data alone: rating, review count,
// place type, operating status, an obvious chain brand in the name, and
// whether we already know this place. What CAN'T be decided mechanically —
// a subtler chain affiliation only visible on the website, who to contact,
// whether an email is actually published — is deliberately left to the
// research routine's own judgment once it reads each kept candidate's
// site; see docs/outreach-research.md for that split.
//
// Deliberately no "server-only" guard, unlike placeCandidates.ts next to
// it: everything here is pure logic over data the caller already fetched —
// no secrets, no fetch, no Node builtins — same reasoning as
// guestReview.ts's "kept framework-free ... trivially unit testable".

import type { OutreachSegment } from "@/lib/data/outreach";
import type { ExistingPartnerIdentifiers } from "@/lib/data/outreach";
import type { PlaceCandidate } from "./placeCandidates";
import { normalizeWebsiteDomain } from "./websiteDomain";

/**
 * Rotated 4 at a time by ISO week number so the same ten neighbourhoods
 * aren't hit every single week — 40 weeks of Places spend before any
 * neighbourhood repeats a second time in the same slot. All inside or just
 * outside the A10, where a hotel guest is realistically walking distance
 * from canal-area attractions.
 */
const HOTEL_NEIGHBOURHOODS = [
  "Jordaan",
  "De Pijp",
  "Oud-West",
  "Centrum",
  "Oud-Zuid",
  "Oost",
  "Westerpark",
  "Nieuwmarkt",
  "Plantage",
  "Rivierenbuurt",
];
const HOTEL_NEIGHBOURHOODS_PER_WEEK = 4;

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function rotatingSlice<T>(items: T[], count: number, weekOf: Date): T[] {
  const start = (isoWeekNumber(weekOf) * count) % items.length;
  const out: T[] = [];
  for (let i = 0; i < count; i++) out.push(items[(start + i) % items.length]);
  return out;
}

/** The Places Text Search queries to run for this week's sweep of one segment. */
export function candidateQueriesFor(segment: OutreachSegment, weekOf: Date = new Date()): string[] {
  if (segment === "hotel") {
    const neighbourhoods = rotatingSlice(HOTEL_NEIGHBOURHOODS, HOTEL_NEIGHBOURHOODS_PER_WEEK, weekOf);
    return neighbourhoods.flatMap((n) => [`hotels in ${n}, Amsterdam`, `bed and breakfast in ${n}, Amsterdam`]);
  }
  if (segment === "operator") {
    return [
      "walking tours Amsterdam",
      "bike tours Amsterdam",
      "food tours Amsterdam",
      "bike rental Amsterdam",
    ];
  }
  // agency: not sourced by the routine yet — see the migration's own comment.
  return [];
}

const CHAIN_NAME_MARKERS = [
  "marriott",
  "hilton",
  "hampton by hilton",
  "doubletree",
  "holiday inn",
  "ihg",
  "accor",
  "novotel",
  "ibis",
  "mercure",
  "sofitel",
  "pullman",
  "nh hotel",
  "nh collection",
  "radisson",
  "citizenm",
  "hyatt",
  "sheraton",
  "westin",
  "renaissance",
  "courtyard by marriott",
  "moxy",
  "student hotel",
  "generator hostel",
  "meininger",
  "premier inn",
  "motel one",
  "clink",
];

/** A cheap, name-only chain check — catches the obvious majority; a subtler affiliation only visible on the site is the research routine's job, not this endpoint's. */
export function looksLikeChainByName(name: string): boolean {
  const lower = name.toLowerCase();
  return CHAIN_NAME_MARKERS.some((marker) => lower.includes(marker));
}

const OPERATOR_TYPE_MARKERS = ["bike", "walking", "food", "museum", "sightseeing"];
/** BoatLocal already covers boat/canal tours via its own catalogue sync — a boat operator here would just duplicate that pipeline. */
const OPERATOR_EXCLUDE_MARKERS = ["boat", "canal", "cruise"];

export interface QualificationThresholds {
  minRating: number;
  minReviewCount: number;
}

export const THRESHOLDS: Record<"hotel" | "operator", QualificationThresholds> = {
  hotel: { minRating: 4.0, minReviewCount: 50 },
  operator: { minRating: 4.5, minReviewCount: 100 },
};

export type RejectReason =
  | "already_known"
  | "not_operational"
  | "low_rating_or_reviews"
  | "chain"
  | "wrong_type"
  | "no_website";

export interface QualifyResult {
  reason: RejectReason | null;
}

/**
 * Every REJECT here is decidable from Google's data (or from our own
 * table) alone — no judgment call. A candidate that passes still goes to
 * the research routine for the judgment-requiring checks (subtler chain
 * affiliation, contact details, one line of "why this one").
 */
export function qualify(
  candidate: PlaceCandidate,
  segment: "hotel" | "operator",
  known: ExistingPartnerIdentifiers,
): QualifyResult {
  const domain = normalizeWebsiteDomain(candidate.website);
  if (
    known.googlePlaceIds.has(candidate.googlePlaceId) ||
    (domain && known.websiteDomains.has(domain)) ||
    known.prospectNames.has(candidate.name.toLowerCase()) ||
    known.companyNames.has(candidate.name.toLowerCase())
  ) {
    return { reason: "already_known" };
  }

  if (candidate.businessStatus && candidate.businessStatus !== "OPERATIONAL") {
    return { reason: "not_operational" };
  }

  if (!candidate.website) {
    return { reason: "no_website" };
  }

  const { minRating, minReviewCount } = THRESHOLDS[segment];
  if (!candidate.rating || !candidate.reviewCount || candidate.rating < minRating || candidate.reviewCount < minReviewCount) {
    return { reason: "low_rating_or_reviews" };
  }

  if (segment === "hotel" && looksLikeChainByName(candidate.name)) {
    return { reason: "chain" };
  }

  if (segment === "operator") {
    const haystack = `${candidate.name} ${candidate.types.join(" ")} ${candidate.primaryType ?? ""}`.toLowerCase();
    if (OPERATOR_EXCLUDE_MARKERS.some((m) => haystack.includes(m))) return { reason: "wrong_type" };
    if (!OPERATOR_TYPE_MARKERS.some((m) => haystack.includes(m))) return { reason: "wrong_type" };
  }

  return { reason: null };
}

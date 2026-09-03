// Affiliate outreach — candidate discovery for the funnel-refill routine
// (docs/outreach-research.md). Bearer-secret gated like the outreach
// reminders cron: the routine has no signed-in admin session, only
// OUTREACH_IMPORT_SECRET as a cloud-environment secret, so this can't use
// getAdminSession() the way the human-facing /api/admin/places/search does.
//
// Does every check that's decidable from Google's own data alone (rating,
// review count, operating status, an obvious chain brand, already known to
// us) — see outreachQualification.ts's own header for why the rest
// (subtler chain affiliation, contact details) is left to the routine,
// which reads each kept candidate's website after this responds.

import { NextResponse } from "next/server";

import { listExistingPartnerIdentifiers } from "@/lib/data/outreach";
import { searchPlaceCandidates, type PlaceCandidate } from "@/lib/admin/placeCandidates";
import { candidateQueriesFor, qualify, type RejectReason } from "@/lib/admin/outreachQualification";

const DEFAULT_LIMIT: Record<"hotel" | "operator", number> = { hotel: 25, operator: 10 };
const MAX_LIMIT = 40;

function checkAuth(request: Request): boolean {
  const secret = process.env.OUTREACH_IMPORT_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!process.env.OUTREACH_IMPORT_SECRET) {
    console.error("[outreach-candidates] OUTREACH_IMPORT_SECRET is not set — refusing all requests");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const segmentParam = searchParams.get("segment");
  if (segmentParam !== "hotel" && segmentParam !== "operator") {
    return NextResponse.json({ error: 'segment must be "hotel" or "operator"' }, { status: 400 });
  }
  const segment = segmentParam;
  const limit = Math.min(Number(searchParams.get("limit")) || DEFAULT_LIMIT[segment], MAX_LIMIT);

  const queries = candidateQueriesFor(segment);
  const known = await listExistingPartnerIdentifiers();

  const seen = new Map<string, PlaceCandidate>();
  for (const query of queries) {
    let results: PlaceCandidate[];
    try {
      results = await searchPlaceCandidates(query);
    } catch (err) {
      console.error(`[outreach-candidates] "${query}" failed:`, err instanceof Error ? err.message : err);
      continue;
    }
    for (const candidate of results) {
      if (!seen.has(candidate.googlePlaceId)) seen.set(candidate.googlePlaceId, candidate);
    }
  }

  const kept: Array<PlaceCandidate & { segment: "hotel" | "operator" }> = [];
  const rejected: Record<RejectReason, number> = {
    already_known: 0,
    not_operational: 0,
    low_rating_or_reviews: 0,
    chain: 0,
    wrong_type: 0,
    no_website: 0,
  };

  // Sort by review count first so the strongest candidates fill the limit
  // — Text Search's own result order isn't ranked by that.
  const candidates = [...seen.values()].sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));

  for (const candidate of candidates) {
    if (kept.length >= limit) break;
    const { reason } = qualify(candidate, segment, known);
    if (reason) {
      rejected[reason]++;
      continue;
    }
    kept.push({ ...candidate, segment });
  }

  return NextResponse.json({
    segment,
    queriesRun: queries,
    candidates: kept,
    rejected,
    rejectedTotal: Object.values(rejected).reduce((a, b) => a + b, 0),
  });
}

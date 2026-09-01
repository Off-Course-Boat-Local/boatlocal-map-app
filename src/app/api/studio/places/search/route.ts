// Studio-gated proxy to Google Places Text Search (New) — same underlying
// call as /api/admin/places/search, just session-checked against a Studio
// (company/guide) session instead of an Admin one, so a company can use the
// same "Search Google Maps" enrichment when adding their own recommendations.
// See src/lib/admin/googlePlaces.ts's header for why this app reaches for
// Google here at all (a deliberate, scoped override of the house rule
// documented in src/lib/studio/geocode.ts) — that override now covers both
// portals' recommendation forms, not just Admin's.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { searchPlaces } from "@/lib/admin/googlePlaces";
import { getDevSession } from "@/lib/studio/devAuth";

export async function GET(request: NextRequest) {
  const session = await getDevSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchPlaces(q);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Google search is unavailable.", results: [] }, { status: 502 });
  }
}

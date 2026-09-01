// Studio-gated proxy to Google Places Details (New) — same underlying call
// as /api/admin/places/details, just session-checked against a Studio
// (company/guide) session instead of an Admin one. See
// src/lib/admin/googlePlaces.ts's header for the house-rule override this is
// part of, and /api/admin/places/details/route.ts's own comment for the
// cost profile (Enterprise+Atmosphere-tier Details plus up to 8 Photo
// calls) — only fired when someone explicitly picks one search result.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getPlaceDetails } from "@/lib/admin/googlePlaces";
import { summarizeVibe } from "@/lib/studio/voiceAssistant";
import { getDevSession } from "@/lib/studio/devAuth";

export async function GET(request: NextRequest) {
  const session = await getDevSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId") ?? "";
  if (!placeId.trim()) {
    return NextResponse.json({ error: "Missing placeId." }, { status: 400 });
  }
  // Only "Talk to add places" swapping to an alternate/manually-searched
  // place asks for this (an extra OpenAI call on top of Places Details) —
  // the plain "Search Google Maps" enrichment on the regular form doesn't
  // pass it, so that flow's cost/latency is unchanged.
  const withVibe = searchParams.get("withVibe") === "1";

  try {
    const details = await getPlaceDetails(placeId.trim());
    const vibeSummary = withVibe ? await summarizeVibe(details.reviewSnippets).catch(() => null) : null;
    return NextResponse.json({ details, vibeSummary });
  } catch {
    return NextResponse.json({ error: "Google details lookup is unavailable." }, { status: 502 });
  }
}

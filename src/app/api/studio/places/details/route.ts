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

  try {
    const details = await getPlaceDetails(placeId.trim());
    return NextResponse.json({ details });
  } catch {
    return NextResponse.json({ error: "Google details lookup is unavailable." }, { status: 502 });
  }
}

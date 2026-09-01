// Admin-only proxy to Google Places Details (New) — fetches one place's
// name/address/area/coordinates/hours/category-guess AND up to 8 photos
// (downloaded server-side and returned as data URLs, ready to drop straight
// into AdminBoatPhotosField's `photos: string[]`). See
// src/lib/admin/googlePlaces.ts's header for the house-rule override this
// is part of.
//
// This is the expensive call (Enterprise+Atmosphere-tier Details plus up to
// 8 Photo calls) — see the cost breakdown given to the user before this was
// built. Only fired when an admin explicitly picks one search result, never
// on every keystroke.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getPlaceDetails } from "@/lib/admin/googlePlaces";
import { getAdminSession } from "@/lib/admin/devAuth";

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
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

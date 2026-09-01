// Guest-facing proxy to the Routes API (src/lib/walkingRoute.ts) — the API
// key is server-only, so the client (DirectionLine.tsx) fetches through
// here rather than calling Google directly. Unauthenticated, same posture
// as every other guest read (see src/proxy.ts's guest-brand-resolution
// section) — there is no guest session to check.
//
// Bounded input, not just type-checked: four finite lat/lngs is the whole
// request shape, so a malformed call fails fast and cheap, before it ever
// reaches a billed Google API call.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getWalkingRoute } from "@/lib/walkingRoute";

function parseCoord(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const originLng = parseCoord(searchParams.get("originLng"));
  const originLat = parseCoord(searchParams.get("originLat"));
  const destLng = parseCoord(searchParams.get("destLng"));
  const destLat = parseCoord(searchParams.get("destLat"));

  if (originLng === null || originLat === null || destLng === null || destLat === null) {
    return NextResponse.json({ error: "Missing or invalid coordinates." }, { status: 400 });
  }

  // Only GuestNavigationScreen's in-app turn-by-turn asks for steps — the
  // map's own line/distance-pill usage (DirectionLine.tsx) never does, to
  // keep that far-more-frequent call's response small.
  const includeSteps = searchParams.get("steps") === "1";

  const route = await getWalkingRoute(
    { lng: originLng, lat: originLat },
    { lng: destLng, lat: destLat },
    { includeSteps },
  );

  if (!route) {
    return NextResponse.json({ error: "No walking route found." }, { status: 502 });
  }

  return NextResponse.json({ route });
}

// Guest-facing proxy to the Routes API (src/lib/walkingRoute.ts) — the API
// key is server-only, so the client (DirectionLine.tsx) fetches through
// here rather than calling Google directly. Unauthenticated, same posture
// as every other guest read (see src/proxy.ts's guest-brand-resolution
// section) — there is no guest session to check.
//
// Bounded input, not just type-checked: four finite lat/lngs is the whole
// request shape, so a malformed call fails fast and cheap, before it ever
// reaches a billed Google API call.
//
// NAME PREDATES TRANSIT: this also serves public-transport itineraries via
// `?mode=transit` (src/lib/transitRoute.ts) since 2026-09-04. The path is
// internal-only (two fetch call sites, both in this repo), so it was left
// alone rather than renamed for cosmetics.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getWalkingRoute } from "@/lib/walkingRoute";
import { getTransitRoute } from "@/lib/transitRoute";
import { isLocale } from "@/lib/i18n/locales";

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

  // Validated against the guest app's own locale registry rather than passed
  // through: this reaches a Google request body, and an arbitrary caller
  // string has no business doing that.
  const lang = searchParams.get("lang");
  const languageCode = isLocale(lang) ? lang : undefined;

  const route =
    searchParams.get("mode") === "transit"
      ? await getTransitRoute(
          { lng: originLng, lat: originLat },
          { lng: destLng, lat: destLat },
          { languageCode },
        )
      : await getWalkingRoute(
          { lng: originLng, lat: originLat },
          { lng: destLng, lat: destLat },
          { includeSteps, languageCode },
        );

  if (!route) {
    return NextResponse.json({ error: "No route found." }, { status: 502 });
  }

  return NextResponse.json({ route });
}

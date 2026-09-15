// Guest-facing proxy to the Routes API (src/lib/walkingRoute.ts,
// src/lib/transitRoute.ts) — the API key is server-only, so the client
// (DirectionLine.tsx, GuestNavigationScreen.tsx) fetches through here rather
// than calling Google directly. Unauthenticated, same posture as every other
// guest read (see src/proxy.ts's guest-brand-resolution section) — there is
// no guest session to check.
//
// NAME PREDATES TRANSIT AND BIKING: this also serves public-transport
// itineraries via `?mode=transit` (since 2026-09-04) and cycling routes via
// `?mode=bike` (since 2026-09-15). The path is internal-only (two fetch call
// sites, both in this repo), so it was left alone rather than renamed for
// cosmetics.
//
// EVERY REQUEST HERE COSTS REAL MONEY, and transit costs more than walking
// (a higher Routes API tier), all drawn from one shared monthly Maps credit
// — so an abusive caller doesn't just run up a transit bill, it takes the
// map's own route line and distance pill down with it. Since there is no
// session to rate-limit against, three cheap guards sit in front of the
// billed call, in ascending order of what they cost us:
//
//   1. Real coordinate BOUNDS (not just "is finite"). This also stops the
//      empty-string case — Number("") is 0, so `?originLat=&originLng=`
//      used to sail through as a perfectly valid (0,0) route request.
//   2. A short-TTL response CACHE keyed on rounded coordinates. A guest who
//      opens walking, closes it, opens transit, then reopens walking used to
//      bill four times; now the repeats are free. It also blunts a naive
//      attack loop, which by definition repeats itself.
//   3. A per-IP RATE LIMIT. Deliberately in-memory: this app has no Redis
//      and adding one for this is a bigger call than the problem warrants.
//      The honest limitation is that serverless gives each instance its own
//      counter, so this raises the cost of casual abuse rather than making
//      it impossible — the real backstop is a hard quota cap on the Google
//      Cloud project, which is a console setting, not code.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getWalkingRoute, getBikingRoute } from "@/lib/walkingRoute";
import { getTransitRoute } from "@/lib/transitRoute";
import { isLocale } from "@/lib/i18n/locales";

/** Rounded to ~11 m before it becomes a cache key — finer than that is noise a guest can't perceive, and a coarser key would mean handing someone a route that visibly starts down the street. */
const CACHE_COORD_DECIMALS = 4;
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 200;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

interface CacheEntry {
  expires: number;
  route: unknown;
}

const routeCache = new Map<string, CacheEntry>();
const requestCounts = new Map<string, { windowStart: number; count: number }>();

function parseCoord(value: string | null, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n) <= max ? n : null;
}

/** True when this caller has already had its allowance this minute. */
function isRateLimited(request: NextRequest): boolean {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const seen = requestCounts.get(ip);

  if (!seen || now - seen.windowStart > RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(ip, { windowStart: now, count: 1 });
    // Opportunistic sweep — no timers in a serverless function.
    if (requestCounts.size > 5_000) {
      for (const [key, value] of requestCounts) {
        if (now - value.windowStart > RATE_LIMIT_WINDOW_MS) requestCounts.delete(key);
      }
    }
    return false;
  }

  seen.count += 1;
  return seen.count > RATE_LIMIT_MAX_REQUESTS;
}

function cacheKey(parts: (string | number)[]): string {
  return parts.join("|");
}

function readCache(key: string): unknown | null {
  const hit = routeCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    routeCache.delete(key);
    return null;
  }
  return hit.route;
}

function writeCache(key: string, route: unknown): void {
  if (routeCache.size >= CACHE_MAX_ENTRIES) {
    // Cheapest possible eviction: drop the oldest insertion. Map preserves
    // insertion order, and this cache is a cost optimisation, not a
    // correctness mechanism, so a smarter policy would be over-engineering.
    const oldest = routeCache.keys().next().value;
    if (oldest !== undefined) routeCache.delete(oldest);
  }
  routeCache.set(key, { expires: Date.now() + CACHE_TTL_MS, route });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const originLng = parseCoord(searchParams.get("originLng"), 180);
  const originLat = parseCoord(searchParams.get("originLat"), 90);
  const destLng = parseCoord(searchParams.get("destLng"), 180);
  const destLat = parseCoord(searchParams.get("destLat"), 90);

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

  // Exact equality, deliberately: anything that isn't literally "transit" or
  // "bike" takes the cheapest, walking path. Never invert this — that would
  // make a pricier tier the default for every malformed or stale-client call.
  const modeParam = searchParams.get("mode");
  const mode = modeParam === "transit" ? "transit" : modeParam === "bike" ? "bike" : "walk";

  const key = cacheKey([
    mode,
    languageCode ?? "-",
    includeSteps ? "steps" : "-",
    originLng.toFixed(CACHE_COORD_DECIMALS),
    originLat.toFixed(CACHE_COORD_DECIMALS),
    destLng.toFixed(CACHE_COORD_DECIMALS),
    destLat.toFixed(CACHE_COORD_DECIMALS),
  ]);

  const cached = readCache(key);
  if (cached) return NextResponse.json({ route: cached });

  // Checked AFTER the cache, so a guest legitimately reopening the same
  // route is never the one who gets throttled.
  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const route =
    mode === "transit"
      ? await getTransitRoute(
          { lng: originLng, lat: originLat },
          { lng: destLng, lat: destLat },
          { languageCode },
        )
      : mode === "bike"
        ? await getBikingRoute(
            { lng: originLng, lat: originLat },
            { lng: destLng, lat: destLat },
            { includeSteps, languageCode },
          )
        : await getWalkingRoute(
            { lng: originLng, lat: originLat },
            { lng: destLng, lat: destLat },
            { includeSteps, languageCode },
          );

  if (!route) {
    // The mode is in the body so a spike of these is greppable in Vercel's
    // logs by feature — the underlying reason is logged server-side by
    // src/lib/googleRoutes.ts.
    return NextResponse.json({ error: "No route found.", mode }, { status: 502 });
  }

  writeCache(key, route);
  return NextResponse.json({ route });
}

// Studio address-lookup proxy.
//
// The browser never calls the geocoder directly. Going through our own
// origin means: the outbound request carries the identifying User-Agent the
// OSM-family services require (a browser can't set that header), the
// provider/API key can change without shipping new client code, the free
// endpoint isn't exposed to whatever a page's CORS config would allow, and
// a guide's keystrokes don't leave with the Studio page's Referer attached.
//
// Session-gated on purpose: this is a Studio tool, not a public endpoint —
// without the check, anyone could point a script at it and burn the shared
// (rate-limited, unauthenticated) upstream quota that every real guide
// depends on. requireDevSession() redirects rather than throws, so this uses
// getDevSession() and returns a plain 401 instead: a fetch() from the form
// wants a status code, not an HTML redirect to /studio/login.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { geocodeSearch } from "@/lib/studio/geocode";
import { getDevSession } from "@/lib/studio/devAuth";

export async function GET(request: NextRequest) {
  const session = await getDevSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (q.trim().length < 3) {
    return NextResponse.json({ results: [] });
  }

  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  const bias =
    latRaw && lngRaw && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;

  try {
    const results = await geocodeSearch(q, { bias });
    return NextResponse.json({ results });
  } catch {
    // The upstream being down or rate-limiting us must not take the form
    // down with it — the client falls back to letting the user place the
    // pin by hand, so a soft failure is the right shape here.
    return NextResponse.json({ error: "Address lookup is unavailable.", results: [] }, { status: 502 });
  }
}

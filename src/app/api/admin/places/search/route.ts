// Admin-only proxy to Google Places Text Search (New) — see
// src/lib/admin/googlePlaces.ts's header for why this app reaches for
// Google here at all (a deliberate, scoped override of the house rule
// documented in src/lib/studio/geocode.ts).
//
// Same session-gating shape as /api/admin/geocode: getAdminSession() (not
// requireAdminSession(), which redirects) so a fetch() from the form gets a
// plain 401 instead of an HTML redirect.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { searchPlaces } from "@/lib/admin/googlePlaces";
import { getAdminSession } from "@/lib/admin/devAuth";

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
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

// Studio reverse-geocode proxy: a clicked map point -> name/address, used by
// the route form's map picker. Same session gate and soft-failure posture as
// the sibling /api/studio/geocode route.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { geocodeReverse } from "@/lib/studio/geocode";
import { getDevSession } from "@/lib/studio/devAuth";

export async function GET(request: NextRequest) {
  const session = await getDevSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return NextResponse.json(
      { error: "Invalid coordinates." },
      { status: 400 },
    );
  }

  try {
    const result = await geocodeReverse({ lat, lng });
    return NextResponse.json({ result });
  } catch {
    // The pin is already placed — a failed lookup just leaves name/address to type.
    return NextResponse.json(
      { error: "Address lookup is unavailable.", result: null },
      { status: 502 },
    );
  }
}

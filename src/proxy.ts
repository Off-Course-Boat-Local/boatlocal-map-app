// Next.js only supports one proxy.ts per project (the renamed
// `middleware.ts` — see node_modules/next/dist/docs/01-app/03-api-reference
// /03-file-conventions/proxy.md), so this file carries three independent
// concerns, each scoped to its own path prefix and safe to edit without
// touching the others. Please keep them in their own clearly-banner-ed
// sections rather than re-splitting this back into separate files (it
// can't be) or tangling their logic together.
//
//   1. STUDIO SUPABASE AUTH GATE — gates /studio/:path*
//   2. ADMIN SUPABASE AUTH GATE  — gates /admin/:path*
//   3. GUEST BRAND RESOLUTION    — runs on every other guest-facing route
//
// All three are routing conveniences only, never the security boundary —
// see each section for what actually enforces access.
//
// Next.js 16 runs Proxy on the Node runtime by default (not Edge), but the
// three-layer posture below still holds regardless: Proxy is for "should
// this request even reach the route" routing, never the sole authorization
// check. See src/lib/supabase/proxy.ts for the client this file uses.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { resolveGuestBrand } from "@/lib/guestBrand";
import {
  GUEST_BRAND_HEADER,
  GUEST_GUIDE_HEADER,
  GUEST_PREVIEW_COOKIE,
  GUEST_PREVIEW_HEADER,
  GUEST_PREVIEW_PARAM,
} from "@/lib/guestHeaders";
import { createProxyClient } from "@/lib/supabase/proxy";

// =============================================================================
// 1. STUDIO SUPABASE AUTH GATE — coarse routing gate ONLY, not a security
//    boundary.
//
// This is layer #1 of the three-layer model: a cheap redirect so an
// anonymous visitor never even sees a flash of the authenticated Studio
// shell before bouncing to /studio/login. It only checks that a *valid*
// Supabase session exists (via getClaims(), which verifies the JWT
// signature — never getSession(), which only reads local cookie state
// without revalidating) — never who it belongs to or what role/company it
// maps to. Layer #2 (a server-side session/profile check called from
// src/app/studio/(protected)/layout.tsx and again from every gated page)
// and layer #3 (every Server Action re-checking its own actor) are the
// layers that actually enforce role and tenant scoping.
// =============================================================================

async function studioAuthGate(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // The login page itself must stay reachable, obviously.
  if (pathname === "/studio/login") {
    return NextResponse.next();
  }

  const { supabase, getResponse } = createProxyClient(request);
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    return NextResponse.redirect(new URL("/studio/login", request.url));
  }

  return getResponse();
}

// =============================================================================
// 2. ADMIN SUPABASE AUTH GATE — coarse routing gate ONLY, not a security
//    boundary. Mirrors the Studio gate above exactly (see its comment for
//    the full three-layer explanation); Admin only ever has the one role,
//    so unlike Studio there is no wrong-*role* case to handle here — layer
//    #2 (a server-side session/allowlist check called from
//    src/app/admin/(protected)/layout.tsx) and layer #3 (every Server
//    Action re-checking itself) are still what actually enforce access.
// =============================================================================

async function adminAuthGate(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // The login page itself must stay reachable, obviously.
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const { supabase, getResponse } = createProxyClient(request);
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return getResponse();
}

// =============================================================================
// 3. GUEST BRAND RESOLUTION — searchParams -> { brandId, guideSlug }.
//
// `?company=<id>&guide=<slug>` on the plain site root is the real, permanent
// routing mechanism — not a stand-in for a subdomain future that isn't
// coming (the founder was explicit that these companies will never be
// assigned subdomains; see src/lib/guestBrand.ts's header comment for the
// full reasoning and src/lib/data/types.ts's CompanyRecord for why `<id>` is
// just the company's own primary key now).
//
// What it does: resolves { brandId, guideSlug } once, at the edge, and
// attaches them as request headers so every Server Component under
// src/app/(guest)/ reads the same already-resolved values via
// `getGuestContext()` (src/lib/guestServerContext.ts) instead of each
// re-implementing query parsing. Also a routing convenience only — nothing
// here is a permission check.
// =============================================================================

function guestBrandResolution(request: NextRequest): NextResponse {
  const { brandId, guideSlug } = resolveGuestBrand({
    searchParams: request.nextUrl.searchParams,
  });

  const headers = new Headers(request.headers);
  headers.set(GUEST_BRAND_HEADER, brandId);
  headers.set(GUEST_GUIDE_HEADER, guideSlug);

  // Studio's preview iframe (src/app/studio/(protected)/preview) loads these
  // same guest routes with `?preview=1`. Mark the request so nothing it does
  // counts as guest traffic — see src/lib/guestPreview.ts for the full
  // reasoning, and src/lib/guestEvents.ts for where the suppression happens.
  const isPreviewEntry =
    request.nextUrl.searchParams.get(GUEST_PREVIEW_PARAM) === "1";
  const alreadyPreviewing =
    request.cookies.get(GUEST_PREVIEW_COOKIE)?.value === "1";

  if (isPreviewEntry || alreadyPreviewing) {
    headers.set(GUEST_PREVIEW_HEADER, "1");
  }

  const response = NextResponse.next({ request: { headers } });

  // Set on the entry request only. A session cookie (no maxAge) deliberately:
  // preview mode should not outlive the browser session that started it.
  if (isPreviewEntry && !alreadyPreviewing) {
    response.cookies.set(GUEST_PREVIEW_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
}

// =============================================================================
// Dispatch
// =============================================================================

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/studio")) {
    return studioAuthGate(request);
  }

  if (pathname.startsWith("/admin")) {
    return adminAuthGate(request);
  }

  return guestBrandResolution(request);
}

export const config = {
  // Everything except API routes, Next internals and static assets. Studio
  // and Admin are excluded from guest-header handling above by the dispatch
  // logic, not by the matcher, so both concerns can share one matcher.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

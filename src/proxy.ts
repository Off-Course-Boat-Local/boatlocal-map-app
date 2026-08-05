// Next.js only supports one proxy.ts per project (the renamed
// `middleware.ts` — see node_modules/next/dist/docs/01-app/03-api-reference
// /03-file-conventions/proxy.md), so this file carries three independent
// concerns, each scoped to its own path prefix and safe to edit without
// touching the others. Please keep them in their own clearly-banner-ed
// sections rather than re-splitting this back into separate files (it
// can't be) or tangling their logic together.
//
//   1. STUDIO DEV AUTH STAND-IN  — gates /studio/:path*
//   2. ADMIN DEV AUTH STAND-IN   — gates /admin/:path*
//   3. GUEST BRAND RESOLUTION    — runs on every other guest-facing route
//
// All three are routing conveniences only, never the security boundary —
// see each section for what actually enforces access.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { resolveGuestBrand } from "@/lib/guestBrand";
import { GUEST_BRAND_HEADER, GUEST_GUIDE_HEADER } from "@/lib/guestHeaders";

// =============================================================================
// 1. STUDIO DEV AUTH STAND-IN — coarse routing gate ONLY, not a security
//    boundary.
//
// This is layer #1 of the three described in the routing research notes for
// this task: a cheap, Edge-runtime redirect so an anonymous visitor never
// even sees a flash of the authenticated Studio shell before bouncing to
// /studio/login. Layer #2 (src/lib/studio/devAuth.ts's requireDevSession(),
// called from src/app/studio/(protected)/layout.tsx and again from every
// gated page) and
// layer #3 (every Server Action re-checking its own actor) are the layers
// that actually matter — this file only checks that *a* session cookie is
// present, never who it belongs to or what role it claims.
//
// SESSION_COOKIE_NAME is duplicated from devAuth.ts rather than imported:
// devAuth.ts pulls in `next/headers` and `next/navigation`, which are meant
// for Server Components/Actions, not Proxy's separate Edge bundle — see the
// "Good to know" note in the proxy.js docs about not relying on shared
// modules. If the cookie name ever changes, update it in both places.
// =============================================================================

const SESSION_COOKIE_NAME = "bl_studio_session";

function studioAuthGate(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // The login page itself must stay reachable, obviously.
  if (pathname === "/studio/login") {
    return NextResponse.next();
  }

  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.redirect(new URL("/studio/login", request.url));
  }

  return NextResponse.next();
}

// =============================================================================
// 2. ADMIN DEV AUTH STAND-IN — coarse routing gate ONLY, not a security
//    boundary. Mirrors the Studio gate above exactly (see its comment for
//    the full three-layer explanation); Admin only ever has the one role,
//    so unlike Studio there is no wrong-*role* case to handle here — layer
//    #2 (requireAdminSession(), called from src/app/admin/(protected)
//    /layout.tsx) and layer #3 (every Server Action re-checking itself) are
//    still what actually enforce access.
//
// SESSION_COOKIE_NAME is duplicated from src/lib/admin/devAuth.ts for the
// same reason the Studio cookie name is duplicated above: this file runs in
// Proxy's Edge bundle, which next/headers-based modules are not meant for.
// If the cookie name ever changes, update it in both places.
// =============================================================================

const ADMIN_SESSION_COOKIE_NAME = "bl_admin_session";

function adminAuthGate(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // The login page itself must stay reachable, obviously.
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (!request.cookies.has(ADMIN_SESSION_COOKIE_NAME)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

// =============================================================================
// 3. GUEST BRAND RESOLUTION — hostname/searchParams -> { brandId, guideSlug }.
//
// WHY THIS EXISTS TODAY EVEN THOUGH IT DOES NOTHING NEW YET: the founder's
// decision is real wildcard-subdomain routing (`{company}.app.boatlocal.nl`)
// once DNS/hosting for it exists, with `?company=`/`?guide=` query params as
// today's stand-in (see src/lib/guestBrand.ts for the shared resolution
// logic both branches use). Wiring the real Proxy now — instead of only the
// query-param path — means turning on real subdomains later is a DNS/hosting
// change, not a code change: this branch already parses `request.nextUrl
// .hostname` on every request, it just never matches anything today because
// no request ever arrives on a real `*.app.boatlocal.nl` host in dev/preview.
//
// What it does: resolves { brandId, guideSlug } once, at the edge, and
// attaches them as request headers so every Server Component under
// src/app/(guest)/ reads the same already-resolved values via
// `getGuestContext()` (src/lib/guestServerContext.ts) instead of each
// re-implementing hostname/query parsing. Also a routing convenience only —
// nothing here is a permission check.
// =============================================================================

function guestBrandResolution(request: NextRequest): NextResponse {
  const { brandId, guideSlug } = resolveGuestBrand({
    hostname: request.nextUrl.hostname,
    pathname: request.nextUrl.pathname,
    searchParams: request.nextUrl.searchParams,
  });

  const headers = new Headers(request.headers);
  headers.set(GUEST_BRAND_HEADER, brandId);
  headers.set(GUEST_GUIDE_HEADER, guideSlug);

  return NextResponse.next({ request: { headers } });
}

// =============================================================================
// Dispatch
// =============================================================================

export function proxy(request: NextRequest) {
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

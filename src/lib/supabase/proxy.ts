// Used ONLY from src/proxy.ts. Proxy runs in its own bundle (see the
// "Good to know" note in node_modules/next/dist/docs/.../proxy.md about not
// relying on shared modules/globals across it and the rest of the app) and
// reads/writes cookies via NextRequest/NextResponse rather than
// `next/headers` — that's why this is a separate client from
// src/lib/supabase/server.ts rather than a shared helper.
//
// This client is for the COARSE gate only (src/proxy.ts's studioAuthGate /
// adminAuthGate): "is there a plausible session at all" -> let the request
// through to the real check. It is never the security boundary itself — see
// src/proxy.ts's own banner comments for the three-layer model.

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Builds a Supabase client scoped to one Proxy invocation, plus a
 * `getResponse()` accessor for the NextResponse that should actually be
 * returned — `setAll` may replace it (e.g. after a token refresh), so the
 * response must always be read back out *after* calling something on
 * `supabase.auth` (e.g. `getClaims()`), never captured up front.
 */
export function createProxyClient(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Supabase proxy client is missing NEXT_PUBLIC_SUPABASE_URL or " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Check .env.local.",
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Mirror onto the request too, so a later `getAll()` call within
        // the same Proxy invocation sees the update.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  return {
    supabase,
    getResponse: () => response,
  };
}

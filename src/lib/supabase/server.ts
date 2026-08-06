// SERVER-ONLY: imports `next/headers` via the `server-only` guard below, so
// an accidental import from a "use client" component fails the build loudly
// (see src/lib/attributionWebhook.ts for the same guard pattern using
// `node:crypto` instead). Use this from Server Components, Server Actions,
// and Route Handlers.
//
// This is the anon-key client: it respects RLS as whoever is actually
// signed in for *this* request (or as an anonymous guest if nobody is). It
// should back most of the data-layer rewrite — src/lib/supabase/admin.ts is
// reserved for the narrow set of operations that genuinely need to bypass
// RLS.
//
// A new client must be created per request (never module-level/shared)
// because it closes over this request's cookies — see the createServerClient
// doc comment in @supabase/ssr about never sharing a client across requests.
//
// `setAll` is wrapped in try/catch because Server Components cannot write
// cookies (Next.js throws if you try) — that's fine here because the proxy
// layer (src/proxy.ts) is what refreshes/re-writes the session cookie on
// each navigation; a Server Component only ever needs to *read* it.

import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Creates a request-scoped Supabase client using the anon key plus the
 * current request's cookies, so every query it makes goes through RLS as
 * the signed-in user (or as `anon` if nobody is signed in).
 */
export async function createClient() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Supabase server client is missing NEXT_PUBLIC_SUPABASE_URL or " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Check .env.local.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render, where cookies can't be
          // set. Safe to ignore as long as src/proxy.ts is also refreshing
          // the session on every navigation (see its "SUPABASE AUTH GATE"
          // sections) — that's what actually keeps the session cookie
          // current.
        }
      },
    },
  });
}

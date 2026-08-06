// CLIENT-SAFE: this file must be importable from a "use client" component
// (e.g. src/components/studio/LoginForm.tsx once it switches off the dev
// auth stand-in). It must NEVER import `next/headers`, `node:crypto`, or
// anything else server-only — doing so would break every Client Component
// that imports it.
//
// Uses the anon/publishable key only (NEXT_PUBLIC_-prefixed, safe to ship to
// the browser). Never import src/lib/supabase/admin.ts from here or from
// anything this file is imported by.
//
// @supabase/ssr's createBrowserClient() manages its own cookie read/write
// via `document.cookie` under the hood, so no cookie plumbing is needed
// here — that's the point of the browser client vs. the server one.

import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Prefer the new publishable key; fall back to the legacy anon key name so
// this keeps working if only one of the two env vars is set.
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Creates a fresh browser-side Supabase client. Instantiate once per
 * component tree call (e.g. inside a `useMemo` or module-level singleton in
 * the calling component) rather than on every render.
 */
export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Supabase browser client is missing NEXT_PUBLIC_SUPABASE_URL or " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Check .env.local.",
    );
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}

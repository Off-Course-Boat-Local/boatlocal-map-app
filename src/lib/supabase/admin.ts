// SERVER-ONLY, SERVICE-ROLE: this client bypasses Row Level Security
// ENTIRELY. `import "server-only"` below makes an accidental import from a
// "use client" component fail the build loudly, rather than silently
// bundling the service-role key into a browser chunk (same guard pattern as
// src/lib/attributionWebhook.ts's `node:crypto` import — do not remove this
// as a "cleanup").
//
// Reserve this for the specific server-side operations that genuinely need
// to bypass RLS — e.g. an Admin-role aggregate query across every tenant,
// or minting a verification link via `auth.admin.generateLink()` for a
// guide/company invite flow. Everywhere else should use
// src/lib/supabase/server.ts (anon key + the signed-in user's session) so
// RLS does real access-control work instead of being routinely bypassed.
//
// Never import this from any file that a Client Component also imports —
// even indirectly. If in doubt, keep call sites inside Server Actions and
// Route Handlers only.
//
// Stateless by design: no cookie handling, since the service role is not
// "signed in" as any particular user.

import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Creates a fresh service-role Supabase client. Callers should still
 * construct their own scoping (e.g. `.eq('company_id', ...)`) even though
 * RLS won't enforce it — this key trusts the caller completely.
 */
export function createAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase admin client is missing NEXT_PUBLIC_SUPABASE_URL or " +
        "SUPABASE_SERVICE_ROLE_KEY. Check .env.local. This client must only " +
        "ever be constructed on the server.",
    );
  }

  return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

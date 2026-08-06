// Magic-link / email-OTP callback. Every Supabase email-based sign-in flow
// (Studio's own sign-in, a guide's invite-link redemption, Admin's
// allowlisted sign-in) should point its `emailRedirectTo` at this route —
// `${origin}/auth/confirm?next=<where to land afterwards>` — rather than
// each building its own callback handling. `origin` should come from
// src/lib/studio/requestOrigin.ts's currentOrigin(), which already solves
// "what's this deployment's real URL" for localhost vs. a real domain; this
// route itself doesn't need it since NextRequest carries its own URL.
//
// Supabase's current email templates send `token_hash` + `type`, verified
// via `verifyOtp` — NOT the older `?code=` + `exchangeCodeForSession` path,
// which is specifically for OAuth/PKCE sign-in (no email round-trip). Both
// are handled here so this one route covers either kind of flow.
//
// This route only ever establishes a session (or doesn't) — it never
// decides *what* profile/role that session is allowed to have. Provisioning
// a `profiles` row (invite redemption, admin allowlist check) is the
// responsibility of whatever server-side flow generated the link in the
// first place, per the "a profiles row must always be created deliberately"
// rule — not something to bolt on here as a side effect of a successful
// verification.

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Only accept a same-origin, absolute-path redirect target. `next` is
 * caller-supplied (a query param on an emailed link), so treat it as
 * untrusted input — a value like `//evil.example` or `https://evil.example`
 * must never be honored as an open redirect.
 */
function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
}

// The landing page behind an invite link (PRD §6.1: "Guide receives an
// invite link from their company; account auto-links to that company.
// 3-field form: name, email, password."). Deliberately outside /studio/ —
// see src/lib/studio/shareLinks.ts's buildInviteUrl for why: every /studio/*
// route is gated by src/proxy.ts's studioAuthGate, which would bounce a
// logged-out invitee to /studio/login before they ever saw this page.
//
// This is the real signup flow inviteGuide() (src/lib/data/source.ts) was
// always building toward: "look up the guide row by invite_token, create
// the auth user, link it to that guide row by email/token, flip status to
// 'active'."
//
// The lookup below uses the service-role admin client, not the ordinary
// anon-key server client, on purpose: an unredeemed invite is
// status='invited', and `guest_public_read` on `guides`
// (supabase/migrations/20260805063611_rls_policies.sql) only allows anon to
// read status='active' rows. A visitor on this page has no session yet
// (they are, by definition, not signed in), so there is no RLS-respecting
// client that could see this row at all — bypassing RLS here is exactly
// the "specific operation that genuinely needs to" case the admin client
// is reserved for, not a convenience shortcut.

import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";

import JoinForm from "./JoinForm";

export const metadata = {
  title: "Join Studio — Boat Local",
};

function InviteUnavailable({
  heading,
  message,
  showLoginLink,
}: {
  heading: string;
  message: string;
  showLoginLink?: boolean;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-100 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">{heading}</h1>
        <p className="text-sm text-neutral-500">{message}</p>
        {showLoginLink ? (
          <Link
            href="/studio/login"
            className="inline-block text-sm font-medium text-neutral-900 underline underline-offset-2"
          >
            Go to sign in
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabaseAdmin = createAdminClient();
  const { data: guide } = await supabaseAdmin
    .from("guides")
    .select("name, email, status")
    .eq("invite_token", token)
    .maybeSingle();

  if (!guide) {
    // Also covers a *redeemed* invite: the join action clears invite_token
    // to null the moment a guide finishes signup (setGuideStatus's own
    // documented behavior, see src/lib/data/source.ts), so a stale/replayed
    // link is genuinely indistinguishable from a fabricated one by this
    // query alone — both come back "not found". Surfacing the sign-in link
    // here too, not just below, covers that (very likely) case.
    return (
      <InviteUnavailable
        heading="Invite not found"
        message="This invite link is invalid, or it's already been used."
        showLoginLink
      />
    );
  }

  if (guide.status !== "invited") {
    return (
      <InviteUnavailable
        heading="Invite no longer valid"
        message="This invite has already been used or is no longer valid."
        showLoginLink
      />
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-100 p-6">
      <JoinForm token={token} defaultName={guide.name} email={guide.email} />
    </div>
  );
}

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
// Also serves a company's OWNER invite (createCompany's owner_invite_token,
// 20260807000000_company_owner_invite.sql) — the same gap for a company's
// first Studio user (role='company') that a guide invite already closed for
// guides. One route serves both: a token is looked up against `guides`
// first, then `companies`, and whichever matches drives the same JoinForm/
// joinAction. See actions.ts for the redemption logic split.
//
// The lookups below use the service-role admin client, not the ordinary
// anon-key server client, on purpose: an unredeemed invite is
// status='invited' (or owner_status='invited'), and the `guest_public_read`
// policies (supabase/migrations/20260805063611_rls_policies.sql) only allow
// anon to read already-active rows. A visitor on this page has no session
// yet (they are, by definition, not signed in), so there is no
// RLS-respecting client that could see either row at all — bypassing RLS
// here is exactly the "specific operation that genuinely needs to" case the
// admin client is reserved for, not a convenience shortcut.

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

  if (guide) {
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

  // No guide matched — try the company-owner invite before giving up. The
  // two token spaces never collide in practice (both are generateInviteToken()
  // UUIDs), but even if they did, a guide match above always wins since it's
  // checked first.
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("owner_email, owner_status")
    .eq("owner_invite_token", token)
    .maybeSingle();

  if (!company) {
    // Also covers a *redeemed* invite: the join action clears invite_token /
    // owner_invite_token the moment signup finishes, so a stale/replayed
    // link is genuinely indistinguishable from a fabricated one by these
    // queries alone — both come back "not found". Surfacing the sign-in
    // link here too, not just below, covers that (very likely) case.
    return (
      <InviteUnavailable
        heading="Invite not found"
        message="This invite link is invalid, or it's already been used."
        showLoginLink
      />
    );
  }

  if (company.owner_status !== "invited" || !company.owner_email) {
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
      <JoinForm token={token} defaultName="" email={company.owner_email} />
    </div>
  );
}

// Company-owner invite delivery — the missing half of createCompany.
//
// createCompany (src/lib/data/source.ts) mints companies.owner_invite_token
// but nothing could ever read it back: the token is deliberately absent
// from CompanyRow/CompanyRecord so it can never leak into a guest-facing
// Brand (see fromCompanyRow's comment there, and the migration
// 20260807000000_company_owner_invite.sql, which notes that this is
// enforced by application code and NOT by RLS, since Postgres RLS is
// row-level rather than column-level). The consequence was that Staff could
// create a company and the owner would never hear about it.
//
// This module is the one narrow, server-only exception. It reads the token
// with an EXPLICIT column list through the service-role admin client —
// exactly the pattern src/app/join/[token]/page.tsx already uses — instead
// of widening the shared CompanyRow type. Nothing here returns a token to a
// Client Component: the only values that cross that boundary are a fully
// built invite URL (which the operator is meant to be able to copy) and a
// send result.
//
// SERVER-ONLY. Callers must have already established an Admin session;
// every exported function here is reachable only from a Server Action in
// src/lib/admin/companyActions.ts, which calls requireAdminSession() first.

import "server-only";

import { emailBaseUrl, isEmailConfigured, sendEmail } from "@/lib/email/client";
import { companyOwnerInviteEmail } from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";

/** Mirrors generateInviteToken() in src/lib/data/source.ts. */
function generateInviteToken(): string {
  return crypto.randomUUID();
}

export interface OwnerInvite {
  companyName: string;
  ownerEmail: string;
  /** Absolute /join/<token> URL. Safe to show an admin; never a guest. */
  inviteUrl: string;
}

/**
 * Reads a company's pending owner invite, or null when there isn't one —
 * no owner email, already redeemed (owner_status='active'), or the token
 * was cleared at redemption.
 */
export async function getOwnerInvite(companyId: string): Promise<OwnerInvite | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("companies")
    .select("name, owner_email, owner_status, owner_invite_token")
    .eq("id", companyId)
    .maybeSingle();

  if (!data?.owner_email || !data.owner_invite_token) return null;
  if (data.owner_status !== "invited") return null;

  return {
    companyName: data.name,
    ownerEmail: data.owner_email,
    inviteUrl: `${emailBaseUrl()}/join/${data.owner_invite_token}`,
  };
}

export type InviteSendResult =
  | { status: "sent"; to: string }
  // Email isn't configured, or the provider rejected it. NOT a failure of
  // whatever database write preceded this — see sendEmail's own comment.
  // The caller is expected to surface the copy-able link instead.
  | { status: "failed"; to: string; error: string }
  | { status: "no-pending-invite" };

/**
 * Emails a company's owner their invite link. Safe to call repeatedly —
 * it re-sends the existing token rather than minting a new one, so an
 * earlier email that did arrive keeps working.
 */
export async function sendOwnerInvite(companyId: string): Promise<InviteSendResult> {
  const invite = await getOwnerInvite(companyId);
  if (!invite) return { status: "no-pending-invite" };

  if (!isEmailConfigured()) {
    return {
      status: "failed",
      to: invite.ownerEmail,
      error: "Email is not configured — copy the invite link and send it manually.",
    };
  }

  const baseUrl = emailBaseUrl();
  const rendered = companyOwnerInviteEmail({
    companyName: invite.companyName,
    inviteUrl: invite.inviteUrl,
    baseUrl,
  });

  const result = await sendEmail({
    to: invite.ownerEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  return result.ok
    ? { status: "sent", to: invite.ownerEmail }
    : { status: "failed", to: invite.ownerEmail, error: result.error };
}

/**
 * Issues a FRESH token for a company whose owner hasn't signed up yet, and
 * emails it.
 *
 * Needed because a token has no recovery path otherwise: the previous one
 * stays valid forever with no way to read it, so a lost invite email
 * strands the company permanently. Rotating also invalidates the old link,
 * which is the behaviour you want if an invite was sent to the wrong
 * address.
 *
 * Refuses to touch a company whose owner is already active — that would
 * silently un-claim a working account.
 */
export async function regenerateOwnerInvite(companyId: string): Promise<InviteSendResult> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("companies")
    .select("owner_email, owner_status")
    .eq("id", companyId)
    .maybeSingle();

  if (!existing?.owner_email || existing.owner_status === "active") {
    return { status: "no-pending-invite" };
  }

  const { error } = await supabase
    .from("companies")
    .update({ owner_invite_token: generateInviteToken(), owner_status: "invited" })
    .eq("id", companyId);

  if (error) {
    return { status: "failed", to: existing.owner_email, error: error.message };
  }

  return sendOwnerInvite(companyId);
}

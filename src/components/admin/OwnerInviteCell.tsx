"use client";

// The recovery path for a company-owner invite: copy the link, re-send the
// existing one, or issue a replacement.
//
// This exists because email is never guaranteed — an unverified sending
// domain, a provider outage, a typo'd address, an invite buried in spam.
// Without it, a company created in Admin whose invite didn't arrive is
// stranded permanently: companies.owner_invite_token is deliberately
// unreadable through CompanyRecord, so there is no other way to recover the
// link (see src/lib/admin/ownerInvite.ts).
//
// The inviteUrl prop is a fully built URL, not a raw token — the server
// decides what the link is (src/lib/admin/ownerInvite.ts, via
// emailBaseUrl()), so nothing here can point it somewhere else, and no bare
// token crosses into client-side code.

import { useActionState, useState } from "react";

import {
  regenerateOwnerInviteAction,
  resendOwnerInviteAction,
  type InviteActionState,
} from "@/lib/admin/companyActions";

const initialState: InviteActionState = {};

const buttonClass =
  "rounded-md border border-[var(--admin-border)] px-2 py-1 text-xs font-medium text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-50";

export default function OwnerInviteCell({
  companyId,
  inviteUrl,
}: {
  companyId: string;
  inviteUrl: string;
}) {
  const [resendState, resend, resending] = useActionState(
    resendOwnerInviteAction.bind(null, companyId),
    initialState,
  );
  const [regenState, regenerate, regenerating] = useActionState(
    regenerateOwnerInviteAction.bind(null, companyId),
    initialState,
  );
  const [copied, setCopied] = useState(false);

  // navigator.clipboard needs a secure context (https or localhost). It is
  // absent over plain http on a LAN IP, which is exactly how someone might
  // reach a dev server from a phone — so failure has to be visible rather
  // than a button that silently does nothing.
  const [copyFailed, setCopyFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
    }
  }

  const status = resendState.error ?? regenState.error ?? resendState.message ?? regenState.message;
  const isError = Boolean(resendState.error ?? regenState.error);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={copy} className={buttonClass}>
          {copied ? "Copied" : "Copy invite link"}
        </button>

        <form action={resend}>
          <button type="submit" disabled={resending} className={buttonClass}>
            {resending ? "Sending…" : "Re-send"}
          </button>
        </form>

        <form action={regenerate}>
          <button
            type="submit"
            disabled={regenerating}
            className={buttonClass}
            title="Issues a new link and invalidates the old one"
          >
            {regenerating ? "Working…" : "New link"}
          </button>
        </form>
      </div>

      {copyFailed ? (
        <input
          readOnly
          value={inviteUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full max-w-xs rounded border border-[var(--admin-border)] bg-transparent px-2 py-1 font-mono text-[10px] text-[var(--admin-ink-soft)]"
        />
      ) : null}

      {status ? (
        <p
          role={isError ? "alert" : "status"}
          className={`text-[11px] ${isError ? "text-red-600" : "text-emerald-700"}`}
        >
          {status}
        </p>
      ) : null}
    </div>
  );
}

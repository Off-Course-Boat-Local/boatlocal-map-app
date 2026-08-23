"use client";

// The Companies table's per-row kebab menu (PRD §8.3's "manage" actions),
// replacing what used to be a row of separate status-change buttons —
// see docs/admin-create-company-modal-handover.md's sibling ask that
// prompted the modal, and the founder's follow-up request to fold Go
// live/Archive/Delete/View into one menu instead of a growing button row.
//
// "Delete" is the one truly irreversible action on this page (status
// changes can always be reversed; a deleted company and everything
// cascade-scoped to it — guides, boat-tour feature picks, recommendations,
// events — cannot), so it gets its own confirmation dialog requiring the
// operator to type the company's name, rather than a plain "are you sure?".
//
// "Copy invite link" / "Re-send" / "New link" used to be a row of buttons
// under the Owner column's status badge (OwnerInviteCell.tsx). The founder
// found that cluttered, especially for a company whose owner hasn't
// accepted yet, and asked for them to live in this same kebab instead. They
// only appear when the caller passes `ownerInvite` — i.e. only while there
// is a pending invite to act on (see getOwnerInvite's doc comment in
// src/lib/admin/ownerInvite.ts) — so an owner who has already redeemed
// their invite, or a company with no owner yet, sees none of these three.
//
// The menu always closes on select (PortalRowMenu's own behaviour), so
// there's nowhere inside it to flash a "Copied!" label the way the old
// inline button did. Instead these three report their result the same way
// Delete's dialog reports its own errors: a small status line, styled like
// OwnerInviteCell's old one, rendered right under the trigger.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import PortalModal from "@/components/PortalModal";
import {
  ArchiveIcon,
  CheckCircleIcon,
  CopyIcon,
  EyeIcon,
  RefreshIcon,
  SendIcon,
  StarIcon,
  TrashIcon,
} from "@/components/PortalIcons";
import PortalRowMenu, { type PortalRowMenuItem } from "@/components/PortalRowMenu";
import {
  deleteCompanyAction,
  regenerateOwnerInviteAction,
  resendOwnerInviteAction,
  setCompanyStatusAction,
} from "@/lib/admin/companyActions";
import {
  setPlatformDefaultCompanyAction,
  unsetPlatformDefaultCompanyAction,
} from "@/lib/admin/defaultCompanyActions";
import type { CompanyStatus } from "@/lib/data/types";

export interface CompanyRowActionsProps {
  companyId: string;
  companyName: string;
  status: CompanyStatus;
  /** Only set while this company has a pending, unredeemed owner invite — see getOwnerInvite(). Omit/null to hide the invite-recovery menu items entirely. */
  ownerInvite?: { inviteUrl: string } | null;
  /** Whether this is the company currently shown to a guest with no `?company=` at all — see src/lib/data/source.ts's getPlatformDefaultCompany. */
  isPlatformDefault: boolean;
}

/** The one next-status action available from a company's current status — same three transitions Admin has always offered, just relocated into the menu. */
function nextStatusAction(status: CompanyStatus): {
  label: string;
  next: CompanyStatus;
  icon: typeof ArchiveIcon;
} {
  switch (status) {
    case "setup":
      return { label: "Go live", next: "active", icon: CheckCircleIcon };
    case "active":
      return { label: "Archive", next: "suspended", icon: ArchiveIcon };
    case "suspended":
      return { label: "Reactivate", next: "active", icon: CheckCircleIcon };
  }
}

export default function CompanyRowActions({
  companyId,
  companyName,
  status,
  ownerInvite,
  isPlatformDefault,
}: CompanyRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<{ tone: "success" | "error"; text: string } | null>(
    null,
  );
  const [defaultCompanyError, setDefaultCompanyError] = useState<string | null>(null);

  const statusAction = nextStatusAction(status);

  const items: PortalRowMenuItem[] = [
    {
      label: "View details",
      icon: EyeIcon,
      onSelect: () => router.push(`/admin/companies/${companyId}`),
    },
    {
      label: statusAction.label,
      icon: statusAction.icon,
      onSelect: () => {
        startTransition(async () => {
          await setCompanyStatusAction(companyId, statusAction.next, new FormData());
          router.refresh();
        });
      },
    },
    {
      // What a guest sees with no `?company=` at all — see
      // src/lib/data/source.ts's getPlatformDefaultCompany. Toggling this
      // never needs a confirmation dialog: setting a new default just moves
      // the flag (setPlatformDefaultCompany clears whichever company held it
      // before), and unsetting it only returns guests to the neutral "Map
      // App" fallback, not any data loss.
      label: isPlatformDefault ? "Unset as default" : "Set as default",
      icon: StarIcon,
      disabled: isPending,
      onSelect: () => {
        setDefaultCompanyError(null);
        startTransition(async () => {
          const result = isPlatformDefault
            ? await unsetPlatformDefaultCompanyAction()
            : await setPlatformDefaultCompanyAction(companyId);
          if (result.error) setDefaultCompanyError(result.error);
          router.refresh();
        });
      },
    },
    ...(ownerInvite
      ? ([
          {
            label: "Copy invite link",
            icon: CopyIcon,
            onSelect: () => {
              navigator.clipboard
                .writeText(ownerInvite.inviteUrl)
                .then(() => {
                  setInviteStatus({ tone: "success", text: "Invite link copied." });
                  setTimeout(() => setInviteStatus(null), 2000);
                })
                .catch(() => {
                  // navigator.clipboard needs a secure context (https or
                  // localhost) — absent over plain http on a LAN IP, which
                  // is exactly how someone might reach a dev server from a
                  // phone, so this has to be visible rather than a menu
                  // item that silently does nothing.
                  setInviteStatus({
                    tone: "error",
                    text: "Couldn't copy — this page isn't in a secure context.",
                  });
                });
            },
          },
          {
            label: "Re-send",
            icon: SendIcon,
            disabled: isPending,
            onSelect: () => {
              startTransition(async () => {
                const result = await resendOwnerInviteAction(companyId, {}, new FormData());
                setInviteStatus(
                  result.error
                    ? { tone: "error", text: result.error }
                    : { tone: "success", text: result.message ?? "Invite re-sent." },
                );
                router.refresh();
              });
            },
          },
          {
            label: "New link",
            icon: RefreshIcon,
            disabled: isPending,
            onSelect: () => {
              startTransition(async () => {
                const result = await regenerateOwnerInviteAction(companyId, {}, new FormData());
                setInviteStatus(
                  result.error
                    ? { tone: "error", text: result.error }
                    : { tone: "success", text: result.message ?? "New invite sent." },
                );
                router.refresh();
              });
            },
          },
        ] satisfies PortalRowMenuItem[])
      : []),
    {
      label: "Delete",
      icon: TrashIcon,
      tone: "danger",
      onSelect: () => {
        setDeleteError(null);
        setConfirmText("");
        setConfirmOpen(true);
      },
    },
  ];

  const canDelete = confirmText === companyName;

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <PortalRowMenu items={items} label={`Actions for ${companyName}`} />
        {inviteStatus ? (
          <p
            role={inviteStatus.tone === "error" ? "alert" : "status"}
            className={`max-w-[200px] text-right text-[11px] ${
              inviteStatus.tone === "error" ? "text-red-600" : "text-emerald-700"
            }`}
          >
            {inviteStatus.text}
          </p>
        ) : null}
        {defaultCompanyError ? (
          <p role="alert" className="max-w-[200px] text-right text-[11px] text-red-600">
            {defaultCompanyError}
          </p>
        ) : null}
      </div>

      <PortalModal
        open={confirmOpen}
        onClose={() => (isPending ? null : setConfirmOpen(false))}
        title="Delete company"
        maxWidthClassName="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--admin-ink-soft)]">
            This permanently deletes <strong className="text-[var(--admin-ink)]">{companyName}</strong>
            {" "}— its guides, boat-tour feature picks, recommendations, and event history all go
            with it. This cannot be undone.
          </p>

          <label className="block text-sm font-medium text-[var(--admin-ink)]">
            Type <span className="font-mono">{companyName}</span> to confirm
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-accent)]"
            />
          </label>

          {deleteError ? (
            <p role="alert" className="text-sm text-red-600">
              {deleteError}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
              className="rounded-md px-3 py-2 text-sm font-medium text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canDelete || isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await deleteCompanyAction(companyId);
                  if (result.error) {
                    setDeleteError(result.error);
                    return;
                  }
                  setConfirmOpen(false);
                  router.refresh();
                });
              }}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Deleting…" : "Delete company"}
            </button>
          </div>
        </div>
      </PortalModal>
    </>
  );
}

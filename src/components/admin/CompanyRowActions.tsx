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

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import PortalModal from "@/components/PortalModal";
import {
  ArchiveIcon,
  CheckCircleIcon,
  EyeIcon,
  TrashIcon,
} from "@/components/PortalIcons";
import PortalRowMenu, { type PortalRowMenuItem } from "@/components/PortalRowMenu";
import { deleteCompanyAction, setCompanyStatusAction } from "@/lib/admin/companyActions";
import type { CompanyStatus } from "@/lib/data/types";

export interface CompanyRowActionsProps {
  companyId: string;
  companyName: string;
  status: CompanyStatus;
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

export default function CompanyRowActions({ companyId, companyName, status }: CompanyRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      <PortalRowMenu items={items} label={`Actions for ${companyName}`} />

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

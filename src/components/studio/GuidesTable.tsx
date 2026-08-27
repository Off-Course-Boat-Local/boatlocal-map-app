"use client";

// Studio Guides — the list itself (PRD §7.3): status + performance columns,
// a per-guide expandable link/QR (invite link while "invited", their own
// share link once "active"/"deactivated"), and the deactivate/reactivate
// action. "use client" only because two small pieces need it — the
// <details> disclosure could be plain HTML, but ShareQr (QR generation) and
// CopyLinkButton (clipboard) both already are, so this whole row lives in
// one client component rather than splitting hairs over which cell needs it.

import ShareQr from "@/components/ShareQr";
import type { GuideStatus } from "@/lib/data/types";
import { setGuideActiveAction } from "@/lib/studio/guideActions";
import CopyLinkButton from "./CopyLinkButton";
import { StatusPill, TableShell, type StudioStatusTone } from "./primitives";

export interface GuideRowData {
  id: string;
  name: string;
  email: string;
  slug: string;
  status: GuideStatus;
  /** The guide's own share link — always computed, even for an invited/deactivated guide, so it's ready the moment they go active. */
  shareUrl: string;
  /** Set only while status is "invited". */
  inviteUrl: string | null;
  tipsSaved: number;
  bookClicks: number;
}

const STATUS_TONES: Record<GuideStatus, StudioStatusTone> = {
  invited: "warning",
  active: "positive",
  deactivated: "neutral",
};

export default function GuidesTable({ guides }: { guides: GuideRowData[] }) {
  return (
    <TableShell
      head={
        <>
          <th>Name</th>
          <th>Email</th>
          <th>Status</th>
          <th className="text-right">Tips saved</th>
          <th className="text-right">Book clicks</th>
          <th>Link &amp; QR</th>
          <th className="text-right">Actions</th>
        </>
      }
    >
      {guides.map((guide) => {
        const isDeactivated = guide.status === "deactivated";
        const linkForShare = guide.inviteUrl ?? guide.shareUrl;

        return (
          <tr key={guide.id} className="align-top">
            <td className="font-medium text-[var(--studio-ink)]">{guide.name}</td>
            <td className="text-[var(--studio-ink-soft)]">{guide.email}</td>
            <td>
              <StatusPill tone={STATUS_TONES[guide.status]}>{guide.status}</StatusPill>
            </td>
            <td className="text-right tabular-nums text-[var(--studio-ink-soft)]">{guide.tipsSaved}</td>
            <td className="text-right tabular-nums text-[var(--studio-ink-soft)]">{guide.bookClicks}</td>
            <td>
              <details>
                <summary className="cursor-pointer text-[var(--studio-accent)] underline decoration-dotted underline-offset-2">
                  {guide.inviteUrl ? "Invite link" : "Show link & QR"}
                </summary>
                <div className="mt-3 flex items-start gap-3">
                  <ShareQr value={linkForShare} size={112} downloadFileName={`${guide.slug}-qr`} />
                  <div className="min-w-0">
                    <p className="break-all font-mono text-[11px] text-[var(--studio-ink-soft)]">
                      {linkForShare}
                    </p>
                    <CopyLinkButton value={linkForShare} className="mt-2" />
                  </div>
                </div>
              </details>
            </td>
            <td className="text-right">
              <form
                action={setGuideActiveAction.bind(null, guide.id, isDeactivated)}
                className="inline-block"
              >
                <button
                  type="submit"
                  className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--studio-ink)] transition-all hover:bg-[var(--studio-bg)] hover:border-[var(--studio-ink-soft)]/40 active:scale-95 cursor-pointer shadow-xs"
                >
                  {isDeactivated ? "Reactivate" : "Deactivate"}
                </button>
              </form>
            </td>
          </tr>
        );
      })}
      {guides.length === 0 ? (
        <tr>
          <td className="text-[var(--studio-ink-soft)]" colSpan={7}>
            No guides yet — invite your first one above.
          </td>
        </tr>
      ) : null}
    </TableShell>
  );
}

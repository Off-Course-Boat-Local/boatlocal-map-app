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

const STATUS_STYLES: Record<GuideStatus, string> = {
  invited: "bg-amber-100 text-amber-800",
  active: "bg-green-100 text-green-800",
  deactivated: "bg-neutral-200 text-neutral-600",
};

function StatusBadge({ status }: { status: GuideStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export default function GuidesTable({ guides }: { guides: GuideRowData[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Tips saved</th>
            <th className="px-4 py-2 font-medium">Book clicks</th>
            <th className="px-4 py-2 font-medium">Link &amp; QR</th>
            <th className="px-4 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {guides.map((guide) => {
            const isDeactivated = guide.status === "deactivated";
            const linkForShare = guide.inviteUrl ?? guide.shareUrl;

            return (
              <tr key={guide.id} className="border-b border-neutral-100 align-top last:border-0">
                <td className="px-4 py-3 text-neutral-900">{guide.name}</td>
                <td className="px-4 py-3 text-neutral-600">{guide.email}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={guide.status} />
                </td>
                <td className="px-4 py-3 text-neutral-600">{guide.tipsSaved}</td>
                <td className="px-4 py-3 text-neutral-600">{guide.bookClicks}</td>
                <td className="px-4 py-3">
                  <details>
                    <summary className="cursor-pointer text-neutral-700 underline decoration-dotted underline-offset-2">
                      {guide.inviteUrl ? "Invite link" : "Show link & QR"}
                    </summary>
                    <div className="mt-3 flex items-start gap-3">
                      <ShareQr value={linkForShare} size={112} downloadFileName={`${guide.slug}-qr`} />
                      <div className="min-w-0">
                        <p className="break-all font-mono text-[11px] text-neutral-600">
                          {linkForShare}
                        </p>
                        <CopyLinkButton value={linkForShare} className="mt-2 rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50" />
                      </div>
                    </div>
                  </details>
                </td>
                <td className="px-4 py-3">
                  <form action={setGuideActiveAction.bind(null, guide.id, isDeactivated)}>
                    <button
                      type="submit"
                      className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
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
              <td className="px-4 py-3 text-neutral-500" colSpan={7}>
                No guides yet — invite your first one above.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

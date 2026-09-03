// Admin Outreach — the affiliate-prospecting list. Cold leads found via
// research (seeded from scripts/import-outreach-prospects.mjs), tracked
// separately from live tenants in Companies (see the migration's own
// comment for why). Sorted so whatever needs attention floats to the top —
// see listOutreachProspects' own ordering comment.

import type { Metadata } from "next";
import Link from "next/link";

import { ADMIN_ACTOR } from "@/lib/admin/actor";
import { listOutreachProspects, type OutreachSegment, type OutreachStatus } from "@/lib/data/outreach";
import AdminTable from "@/components/admin/AdminTable";
import OutreachImportButton from "@/components/admin/OutreachImportButton";
import { PageHeader } from "@/components/admin/primitives";
import StatusBadge from "@/components/admin/StatusBadge";

export const metadata: Metadata = { title: "Outreach" };

const STATUS_TONE: Record<OutreachStatus, "positive" | "neutral" | "warning"> = {
  not_contacted: "neutral",
  emailed: "neutral",
  replied: "positive",
  declined: "warning",
  onboarded: "positive",
};

const STATUS_LABEL: Record<OutreachStatus, string> = {
  not_contacted: "Not contacted",
  emailed: "Emailed",
  replied: "Replied",
  declined: "Declined",
  onboarded: "Onboarded",
};

const SEGMENT_LABEL: Record<OutreachSegment, string> = {
  operator: "Operator",
  hotel: "Hotel",
  agency: "Agency",
};

/** How long a prospect the research routine (docs/outreach-research.md) added still gets the "New" mark. */
const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const COLUMN_WIDTHS = [
  "min-w-[200px]",
  "w-24",
  "min-w-[160px]",
  "min-w-[140px]",
  "w-32",
  "min-w-[160px]",
];

function formatDue(dueAt: string | null, actionType: string | null, now: number): string | null {
  if (!dueAt || !actionType) return null;
  const due = new Date(dueAt);
  const overdue = due.getTime() <= now;
  const label = actionType === "call" ? "Call" : "Follow-up";
  const dateStr = due.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${label} ${overdue ? "overdue" : "due"} ${dateStr}`;
}

export default async function AdminOutreachPage() {
  const prospects = await listOutreachProspects(ADMIN_ACTOR);
  // Read once (same pattern as src/app/studio/(protected)/report/page.tsx) —
  // a bare Date.now()/new Date() call inline inside a .map/.filter callback
  // or JSX trips the react-hooks/purity lint rule even in a Server
  // Component; hoisting it to one read here does not.
  const now = Date.now();

  const rows = prospects.map((prospect) => {
    const due = formatDue(prospect.nextActionDueAt, prospect.nextActionType, now);
    const overdue = Boolean(prospect.nextActionDueAt && new Date(prospect.nextActionDueAt).getTime() <= now);
    const isNew = prospect.source === "agent" && now - new Date(prospect.createdAt).getTime() <= NEW_WINDOW_MS;

    return [
      <Link
        key="name"
        href={`/admin/outreach/${prospect.id}`}
        className="flex items-center gap-2 font-medium text-[var(--admin-ink)] hover:underline"
      >
        {prospect.name}
        {isNew ? (
          <span className="rounded-full bg-[var(--admin-accent)]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-accent)]">
            New
          </span>
        ) : null}
      </Link>,
      <span key="segment" className="text-[var(--admin-ink-soft)]">
        {SEGMENT_LABEL[prospect.segment]}
      </span>,
      <span key="tourType" className="text-[var(--admin-ink-soft)]">
        {prospect.tourType ?? "—"}
      </span>,
      <span key="rating" className="text-[var(--admin-ink-soft)]">
        {prospect.taRating ? `★ ${prospect.taRating} (${prospect.taReviewCount ?? 0})` : "—"}
      </span>,
      <StatusBadge key="status" status={STATUS_LABEL[prospect.status]} tone={STATUS_TONE[prospect.status]} />,
      <span key="due" className={overdue ? "font-medium text-red-600" : "text-[var(--admin-ink-soft)]"}>
        {due ?? "—"}
      </span>,
    ];
  });

  return (
    <div>
      <PageHeader
        title="Outreach"
        description="Cold-prospecting tracker for bike, walking, and food tour operators — separate from Companies until one is actually onboarded."
        hint={`${prospects.length} prospect${prospects.length === 1 ? "" : "s"} · ${
          prospects.filter((p) => p.nextActionDueAt && new Date(p.nextActionDueAt).getTime() <= now).length
        } follow-up(s) overdue · ${
          prospects.filter((p) => p.source === "agent" && now - new Date(p.createdAt).getTime() <= NEW_WINDOW_MS)
            .length
        } new this week`}
        action={<OutreachImportButton />}
      />

      <AdminTable
        columns={["Name", "Segment", "Tour type", "Rating", "Status", "Next action"]}
        columnWidths={COLUMN_WIDTHS}
        rows={rows}
        emptyMessage="No prospects yet — run scripts/import-outreach-prospects.mjs to seed from the research CSV, or use Import CSV above."
      />
    </div>
  );
}

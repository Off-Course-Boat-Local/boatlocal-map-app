"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, RotateCcw } from "lucide-react";

import type { OutreachProspect, OutreachSegment } from "@/lib/data/outreach";
import { OUTREACH_STATUS_LABELS } from "@/lib/admin/outreachStatus";
import { formatLastContact } from "@/lib/admin/outreachTouchpoints";
import AdminTable from "@/components/admin/AdminTable";
import OutreachStatusDropdown from "@/components/admin/OutreachStatusDropdown";

const SEGMENT_LABEL: Record<OutreachSegment, string> = {
  operator: "Operator",
  hotel: "Hotel",
  agency: "Agency",
};

/** How long a prospect the research routine added still gets the "New" mark. */
const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const COLUMN_WIDTHS = [
  "min-w-[200px]",
  "w-24",
  "min-w-[150px]",
  "min-w-[130px]",
  "w-36",
  "min-w-[190px]",
];

export type SortField =
  | "name"
  | "segment"
  | "tourType"
  | "rating"
  | "status"
  | "nextAction"
  | "lastContact";

export type SortDirection = "asc" | "desc";

function formatDue(dueAt: string | null, actionType: string | null, now: number): string | null {
  if (!dueAt || !actionType) return null;
  const due = new Date(dueAt);
  const overdue = due.getTime() <= now;
  const label = actionType === "call" ? "Call" : "Follow-up";
  const dateStr = due.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${label} ${overdue ? "overdue" : "due"} ${dateStr}`;
}

interface ColumnHeaderProps {
  field: SortField;
  label: string;
  activeField: SortField | null;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

function ColumnHeader({
  field,
  label,
  activeField,
  sortDirection,
  onSort,
}: ColumnHeaderProps) {
  const isActive = activeField === field;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="group -mx-1.5 -my-1 inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-[0.6875rem] font-semibold tracking-[0.14em] uppercase transition-colors hover:text-[var(--admin-ink)] focus:outline-none cursor-pointer"
      title={`Sort by ${label}${isActive ? (sortDirection === "asc" ? " (oplopend, click for aflopend)" : " (aflopend, click to reset)") : " (click for oplopend)"}`}
    >
      <span className={isActive ? "text-[var(--admin-ink)] font-bold" : ""}>{label}</span>
      <span className="shrink-0 flex items-center gap-1">
        {isActive ? (
          sortDirection === "asc" ? (
            <>
              <ArrowUp className="h-3 w-3 text-[var(--admin-accent)]" />
              <span className="text-[10px] font-semibold normal-case tracking-normal text-[var(--admin-accent)]">
                oplopend
              </span>
            </>
          ) : (
            <>
              <ArrowDown className="h-3 w-3 text-[var(--admin-accent)]" />
              <span className="text-[10px] font-semibold normal-case tracking-normal text-[var(--admin-accent)]">
                aflopend
              </span>
            </>
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40" />
        )}
      </span>
    </button>
  );
}

export interface OutreachProspectsTableProps {
  prospects: OutreachProspect[];
}

export default function OutreachProspectsTable({ prospects }: OutreachProspectsTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [now] = useState(() => Date.now());

  function handleSort(field: SortField) {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection(field === "rating" || field === "lastContact" ? "desc" : "asc");
    }
  }

  const sortedProspects = useMemo(() => {
    if (!sortField) return prospects;

    const copy = [...prospects];
    copy.sort((a, b) => {
      let cmp = 0;

      switch (sortField) {
        case "name": {
          cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
          break;
        }
        case "segment": {
          const segA = SEGMENT_LABEL[a.segment] ?? "";
          const segB = SEGMENT_LABEL[b.segment] ?? "";
          cmp = segA.localeCompare(segB);
          break;
        }
        case "tourType": {
          const typeA = a.tourType ?? "";
          const typeB = b.tourType ?? "";
          if (!typeA && !typeB) cmp = 0;
          else if (!typeA) cmp = 1;
          else if (!typeB) cmp = -1;
          else cmp = typeA.localeCompare(typeB);
          break;
        }
        case "rating": {
          const ratingA = a.taRating ?? -1;
          const ratingB = b.taRating ?? -1;
          if (ratingA !== ratingB) {
            cmp = ratingA - ratingB;
          } else {
            const reviewsA = a.taReviewCount ?? 0;
            const reviewsB = b.taReviewCount ?? 0;
            cmp = reviewsA - reviewsB;
          }
          break;
        }
        case "status": {
          const labelA = OUTREACH_STATUS_LABELS[a.status] ?? a.status;
          const labelB = OUTREACH_STATUS_LABELS[b.status] ?? b.status;
          cmp = labelA.localeCompare(labelB);
          break;
        }
        case "nextAction": {
          const dueA = a.nextActionDueAt ? new Date(a.nextActionDueAt).getTime() : null;
          const dueB = b.nextActionDueAt ? new Date(b.nextActionDueAt).getTime() : null;
          if (dueA === null && dueB === null) cmp = 0;
          else if (dueA === null) cmp = 1;
          else if (dueB === null) cmp = -1;
          else cmp = dueA - dueB;
          break;
        }
        case "lastContact": {
          const timeA = a.lastContactedAt ? new Date(a.lastContactedAt).getTime() : null;
          const timeB = b.lastContactedAt ? new Date(b.lastContactedAt).getTime() : null;
          if (timeA === null && timeB === null) cmp = 0;
          else if (timeA === null) cmp = 1;
          else if (timeB === null) cmp = -1;
          else cmp = timeA - timeB;
          break;
        }
      }

      return sortDirection === "asc" ? cmp : -cmp;
    });

    return copy;
  }, [prospects, sortField, sortDirection]);

  const columns = [
    <ColumnHeader
      key="name"
      field="name"
      label="Name"
      activeField={sortField}
      sortDirection={sortDirection}
      onSort={handleSort}
    />,
    <ColumnHeader
      key="segment"
      field="segment"
      label="Segment"
      activeField={sortField}
      sortDirection={sortDirection}
      onSort={handleSort}
    />,
    <ColumnHeader
      key="tourType"
      field="tourType"
      label="Tour type"
      activeField={sortField}
      sortDirection={sortDirection}
      onSort={handleSort}
    />,
    <ColumnHeader
      key="rating"
      field="rating"
      label="Rating"
      activeField={sortField}
      sortDirection={sortDirection}
      onSort={handleSort}
    />,
    <ColumnHeader
      key="status"
      field="status"
      label="Status"
      activeField={sortField}
      sortDirection={sortDirection}
      onSort={handleSort}
    />,
    <ColumnHeader
      key="nextAction"
      field="nextAction"
      label="Next action"
      activeField={sortField}
      sortDirection={sortDirection}
      onSort={handleSort}
    />,
  ];

  const rows = sortedProspects.map((prospect) => {
    const due = formatDue(prospect.nextActionDueAt, prospect.nextActionType, now);
    const overdue = Boolean(prospect.nextActionDueAt && new Date(prospect.nextActionDueAt).getTime() <= now);
    const isNew = prospect.source === "agent" && now - new Date(prospect.createdAt).getTime() <= NEW_WINDOW_MS;
    const lastContact = formatLastContact(prospect.lastContactedAt, prospect.events, now);

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
      <OutreachStatusDropdown key="status" prospectId={prospect.id} currentStatus={prospect.status} />,
      <div key="action" className="space-y-0.5">
        <div className={overdue ? "font-medium text-red-600" : "text-[var(--admin-ink)]"}>
          {due ?? "—"}
        </div>
        {lastContact ? (
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                lastContact.channel === "whatsapp"
                  ? "bg-emerald-500"
                  : lastContact.isMeetingProposed
                    ? "bg-purple-500"
                    : lastContact.channel === "meeting_held"
                      ? "bg-indigo-500"
                      : lastContact.channel === "call"
                        ? "bg-amber-500"
                        : lastContact.channel === "in_person"
                          ? "bg-orange-500"
                          : lastContact.channel === "email"
                            ? "bg-sky-500"
                            : "bg-zinc-400"
              }`}
            />
            <span className="font-medium text-[var(--admin-ink)]">{lastContact.label}</span>
            <span className="text-[var(--admin-ink-soft)]">({lastContact.relativeTime})</span>
          </div>
        ) : (
          <div className="text-[11px] text-[var(--admin-ink-soft)]/60">
            No contact logged
          </div>
        )}
      </div>,
    ];
  });

  return (
    <div className="space-y-2">
      {sortField ? (
        <div className="flex items-center justify-between text-xs text-[var(--admin-ink-soft)] px-1">
          <span>
            Sorted by <strong className="font-semibold text-[var(--admin-ink)]">{sortField}</strong> ({sortDirection === "asc" ? "oplopend / ascending" : "aflopend / descending"})
          </span>
          <button
            type="button"
            onClick={() => {
              setSortField(null);
              setSortDirection("asc");
            }}
            className="inline-flex items-center gap-1 font-medium text-[var(--admin-accent)] hover:underline cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to default queue order
          </button>
        </div>
      ) : null}

      <AdminTable
        columns={columns}
        columnWidths={COLUMN_WIDTHS}
        rows={rows}
        emptyMessage="No prospects yet — run scripts/import-outreach-prospects.mjs to seed from the research CSV, or use Import CSV above."
      />
    </div>
  );
}

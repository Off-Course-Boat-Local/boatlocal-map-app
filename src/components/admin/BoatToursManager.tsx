"use client";

// Admin > Boats — full CRUD for the platform boat tour catalog (PRD §8.2).
// Modern, sleek card-based drag-and-drop reordering with full visual lift,
// drop insertion indicators, thumbnail previews, high-contrast badges,
// and smooth continuous reordering without locking up.

import { GripVertical, Pencil, Plus, Ship } from "lucide-react";
import { useRouter } from "next/navigation";
import { type DragEvent, type KeyboardEvent, useEffect, useState, useTransition } from "react";

import type { BoatTourRecord } from "@/lib/data/types";
import {
  deleteBoatTourAction,
  reorderBoatToursAction,
  toggleBoatTourStatusAction,
} from "@/lib/admin/boatTourActions";
import { ArchiveIcon, CheckCircleIcon, TrashIcon } from "@/components/PortalIcons";
import PortalRowMenu, { type PortalRowMenuItem } from "@/components/PortalRowMenu";
import PortalModal from "@/components/PortalModal";
import { PRIMARY_BUTTON_CLASS } from "./primitives";
import StatusBadge from "./StatusBadge";
import BoatTourForm from "./BoatTourForm";

export interface BoatToursManagerProps {
  initialTours: BoatTourRecord[];
}

type EditingState = { mode: "new" } | { mode: "edit"; tour: BoatTourRecord } | null;

export default function BoatToursManager({ initialTours }: BoatToursManagerProps) {
  const [tours, setTours] = useState<BoatTourRecord[]>(() =>
    [...initialTours].sort((a, b) => a.position - b.position),
  );
  const [editing, setEditing] = useState<EditingState>(null);
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after">("before");

  const router = useRouter();

  // Sync state whenever server revalidates initialTours
  useEffect(() => {
    setTours([...initialTours].sort((a, b) => a.position - b.position));
  }, [initialTours]);

  const nextPosition = tours.reduce((max, t) => Math.max(max, t.position), 0) + 1;

  function runAction(id: string, run: () => Promise<{ error?: string } | void>) {
    setPendingId(id);
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await run();
        if (result && "error" in result && result.error) setActionError(result.error);
      } finally {
        router.refresh();
        setPendingId(null);
      }
    });
  }

  function handleDragStart(e: DragEvent<HTMLDivElement>, id: string) {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = e.clientY < midpoint ? "before" : "after";

    if (dropTargetId !== targetId || dropPosition !== position) {
      setDropTargetId(targetId);
      setDropPosition(position);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault();
    const sourceId = draggedId;
    const position = dropPosition;

    setDraggedId(null);
    setDropTargetId(null);

    if (!sourceId || sourceId === targetId) return;

    const ordered = [...tours].sort((a, b) => a.position - b.position);
    const sourceIndex = ordered.findIndex((t) => t.id === sourceId);
    if (sourceIndex === -1) return;

    const [movedItem] = ordered.splice(sourceIndex, 1);
    const targetIndex = ordered.findIndex((t) => t.id === targetId);
    if (targetIndex === -1) return;

    const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
    ordered.splice(insertIndex, 0, movedItem);

    const renumbered = ordered.map((t, idx) => ({ ...t, position: idx + 1 }));
    setTours(renumbered);

    const orderedIds = renumbered.map((t) => t.id);
    startTransition(async () => {
      try {
        await reorderBoatToursAction(orderedIds);
      } catch {
        setTours([...initialTours].sort((a, b) => a.position - b.position));
      }
    });
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDropTargetId(null);
  }

  function handleKeyboardReorder(e: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();

    const ordered = [...tours].sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((t) => t.id === id);
    const swapIndex = e.key === "ArrowUp" ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= ordered.length) return;

    const reordered = [...ordered];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    const renumbered = reordered.map((t, idx) => ({ ...t, position: idx + 1 }));
    setTours(renumbered);

    const orderedIds = renumbered.map((t) => t.id);
    startTransition(async () => {
      try {
        await reorderBoatToursAction(orderedIds);
      } catch {
        setTours([...initialTours].sort((a, b) => a.position - b.position));
      }
    });
  }

  async function handleDelete(tour: BoatTourRecord) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete "${tour.name}"? This removes it from every company's map. This can't be undone.`)
    ) {
      return;
    }
    runAction(tour.id, () => deleteBoatTourAction(tour.id));
  }

  const ordered = [...tours].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--admin-ink-soft)]">
            Drag cards to rearrange the catalog order. {tours.length} tour{tours.length === 1 ? "" : "s"} total.
          </p>
        </div>
        <button type="button" onClick={() => setEditing({ mode: "new" })} className={PRIMARY_BUTTON_CLASS}>
          <Plus className="size-4" strokeWidth={2} />
          Add tour
        </button>
      </div>

      {actionError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {actionError}
        </p>
      ) : null}

      {/* Modern Sleek Draggable Cards List */}
      <div className="space-y-2.5">
        {ordered.map((tour, index) => {
          const rowPending = pendingId === tour.id;
          const isDraggingThis = draggedId === tour.id;
          const isOverTarget = dropTargetId === tour.id;
          const photo = tour.photos && tour.photos[0];

          const menuItems: PortalRowMenuItem[] = [
            {
              label: "Edit",
              icon: Pencil,
              onSelect: () => setEditing({ mode: "edit", tour }),
            },
            {
              label: tour.status === "active" ? "Deactivate" : "Activate",
              icon: tour.status === "active" ? ArchiveIcon : CheckCircleIcon,
              disabled: rowPending,
              onSelect: () => runAction(tour.id, () => toggleBoatTourStatusAction(tour.id)),
            },
            {
              label: "Delete",
              icon: TrashIcon,
              tone: "danger",
              disabled: rowPending,
              onSelect: () => handleDelete(tour),
            },
          ];

          return (
            <div
              key={tour.id}
              draggable
              onDragStart={(e) => handleDragStart(e, tour.id)}
              onDragOver={(e) => handleDragOver(e, tour.id)}
              onDrop={(e) => handleDrop(e, tour.id)}
              onDragEnd={handleDragEnd}
              className={[
                "group relative flex items-center gap-3.5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3.5 transition-all duration-150",
                "hover:border-[var(--admin-accent)]/50 hover:shadow-xs",
                isDraggingThis ? "opacity-30 scale-[0.99] border-dashed border-[var(--admin-accent)]" : "opacity-100",
                isOverTarget && dropPosition === "before" ? "border-t-2 border-t-[var(--admin-accent)] -translate-y-0.5" : "",
                isOverTarget && dropPosition === "after" ? "border-b-2 border-b-[var(--admin-accent)] translate-y-0.5" : "",
              ].join(" ")}
            >
              {/* Drag Handle & High-Contrast Order Pill */}
              <div className="flex items-center gap-2.5 select-none">
                {/* Drag Handle with contrast hover state */}
                <button
                  type="button"
                  aria-label={`Reorder ${tour.name}. Use arrow up and down keys to move.`}
                  onKeyDown={(e) => handleKeyboardReorder(e, tour.id)}
                  className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-ink-soft)] transition-all hover:bg-[var(--admin-accent)] hover:border-[var(--admin-accent)] hover:text-white"
                >
                  <GripVertical className="size-4 text-inherit" strokeWidth={2.25} />
                </button>

                {/* High Contrast Order Pill */}
                <span className="flex size-6.5 shrink-0 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold tabular-nums text-slate-800 dark:text-slate-100 shadow-2xs">
                  {index + 1}
                </span>
              </div>

              {/* Thumbnail / Boat Icon */}
              <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 border border-[var(--admin-border)] flex items-center justify-center">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={tour.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      // Gracefully hide broken image and show placeholder icon
                      e.currentTarget.style.display = "none";
                      e.currentTarget.parentElement?.querySelector(".fallback-boat-icon")?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <Ship className={`size-6 text-[var(--admin-ink-soft)] fallback-boat-icon ${photo ? "hidden" : ""}`} />
              </div>

              {/* Tour Details */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-[var(--admin-ink)]">
                    {tour.name}
                  </h3>
                  <StatusBadge
                    status={tour.status}
                    tone={tour.status === "active" ? "positive" : "neutral"}
                  />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--admin-ink-soft)]">
                  <span>{tour.area}</span>
                  {tour.meta ? (
                    <>
                      <span>•</span>
                      <span>{tour.meta}</span>
                    </>
                  ) : null}
                  {tour.photos ? (
                    <>
                      <span>•</span>
                      <span>{tour.photos.length} photo{tour.photos.length === 1 ? "" : "s"}</span>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Actions Menu */}
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditing({ mode: "edit", tour })}
                  title={`Edit ${tour.name}`}
                  aria-label={`Edit ${tour.name}`}
                  className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 text-[var(--admin-ink-soft)] transition-all hover:border-[var(--admin-accent)]/40 hover:bg-[var(--admin-nav-active-bg)] hover:text-[var(--admin-accent)] active:scale-95 shadow-2xs"
                >
                  <Pencil className="size-4" />
                </button>
                <PortalRowMenu items={menuItems} label={`Actions for ${tour.name}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Modal Form */}
      <PortalModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.mode === "edit" ? "Edit boat tour" : "Add boat tour"}
        maxWidthClassName="max-w-2xl"
      >
        {editing ? (
          <BoatTourForm
            tour={editing.mode === "edit" ? editing.tour : null}
            suggestedPosition={nextPosition}
            onDone={() => {
              setEditing(null);
              router.refresh();
            }}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </PortalModal>
    </div>
  );
}

"use client";

// Admin > Boats — full CRUD for the platform boat tour catalog (PRD §8.2).
// This is the ONLY place a boat tour can be created, edited, deleted, or
// reordered — Studio's Boat tours tab (src/components/studio/
// BoatToursManager.tsx) only toggles/reorders which of these a company
// features on its own guest map, never the tour record itself.
//
// State here is optimistic for reordering and status toggles (mirroring
// Studio's BoatToursManager pattern): an interaction reorders/updates local
// state immediately, fires the matching Server Action, and resyncs with the
// server via router.refresh() either way, so this never silently drifts
// from what the Server Action actually persisted. Create/edit/delete go
// through the modal and rely on revalidatePath (from the Server Action) +
// router.refresh for the resulting list update.
//
// Reordering is native HTML5 drag-and-drop (draggable/onDragStart/
// onDragOver/onDrop/onDragEnd) rather than a dnd-kit/react-beautiful-dnd
// dependency, matching this app's existing "hand-roll interactions instead
// of pulling in a library" convention (e.g. guest's DatePickerField). Known
// gap: native HTML5 DnD has no built-in keyboard story, so the grip handle
// also supports ArrowUp/ArrowDown (see handleKeyboardReorder) as a keyboard/
// screen-reader-usable equivalent of the old up/down buttons — mouse-drag
// and arrow-keys both funnel into the same commitReorder() so the persisted
// result is identical either way.
//
// AdminTable (deliberately not touched by this change) owns each row's
// actual <tr> and doesn't expose per-row drag events, so every cell's
// content here is individually wrapped by withDropZone() with a negative
// margin matching AdminTable's own cell padding (px-5 py-4) — that makes
// each wrapper div cover its whole <td>, so dropping anywhere across a row
// (not just on the grip handle) registers correctly.

import { GripVertical, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type DragEvent, type KeyboardEvent, type ReactNode, useState, useTransition } from "react";

import type { BoatTourRecord } from "@/lib/data/types";
import {
  deleteBoatTourAction,
  reorderBoatToursAction,
  toggleBoatTourStatusAction,
} from "@/lib/admin/boatTourActions";
import { ArchiveIcon, CheckCircleIcon, TrashIcon } from "@/components/PortalIcons";
import PortalRowMenu, { type PortalRowMenuItem } from "@/components/PortalRowMenu";
import { PRIMARY_BUTTON_CLASS } from "./primitives";
import AdminTable from "./AdminTable";
import StatusBadge from "./StatusBadge";
import BoatTourForm from "./BoatTourForm";

export interface BoatToursManagerProps {
  initialTours: BoatTourRecord[];
}

type EditingState = { mode: "new" } | { mode: "edit"; tour: BoatTourRecord } | null;

export default function BoatToursManager({ initialTours }: BoatToursManagerProps) {
  const [tours, setTours] = useState(
    [...initialTours].sort((a, b) => a.position - b.position),
  );
  const [editing, setEditing] = useState<EditingState>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const router = useRouter();

  const nextPosition = tours.reduce((max, t) => Math.max(max, t.position), 0) + 1;

  function runAction(id: string, run: () => Promise<{ error?: string } | void>) {
    setPendingId(id);
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await run();
        if (result && "error" in result && result.error) setActionError(result.error);
      } finally {
        // Resync with the server's actual state either way — cheap
        // insurance against optimistic state drifting from what the
        // fake store (or, later, Supabase) actually persisted.
        router.refresh();
        setPendingId(null);
      }
    });
  }

  /**
   * Applies a full new order to local state optimistically: every tour gets
   * repositioned to its 1-based index in `orderedIds`, matching exactly
   * what reorderBoatToursAction persists server-side. Shared by both the
   * mouse-drag drop handler and the keyboard arrow-key handler below so
   * dragging and keyboard reordering produce identical results.
   */
  function commitReorder(orderedIds: string[]) {
    setTours((prev) =>
      prev.map((t) => {
        const index = orderedIds.indexOf(t.id);
        return index === -1 ? t : { ...t, position: index + 1 };
      }),
    );
  }

  function handleDragStart(e: DragEvent<HTMLButtonElement>, id: string) {
    if (isPending) {
      e.preventDefault();
      return;
    }
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, overId: string) {
    if (!draggedId || draggedId === overId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== overId) setDragOverId(overId);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault();
    const sourceId = draggedId;
    setDraggedId(null);
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;

    const ordered = [...tours].sort((a, b) => a.position - b.position);
    const sourceIndex = ordered.findIndex((t) => t.id === sourceId);
    const targetIndex = ordered.findIndex((t) => t.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const reordered = [...ordered];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const orderedIds = reordered.map((t) => t.id);

    commitReorder(orderedIds);
    runAction(sourceId, () => reorderBoatToursAction(orderedIds));
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverId(null);
  }

  /**
   * Keyboard equivalent of the removed up/down buttons, kept on the drag
   * handle itself since native HTML5 DnD offers no keyboard story on its
   * own (see this file's header comment) — Arrow Up/Down swap the focused
   * row with its neighbour, same shape as a one-slot mouse drag.
   */
  function handleKeyboardReorder(e: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    if (isPending) return;

    const ordered = [...tours].sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((t) => t.id === id);
    const swapIndex = e.key === "ArrowUp" ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= ordered.length) return;

    const reordered = [...ordered];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    const orderedIds = reordered.map((t) => t.id);

    commitReorder(orderedIds);
    runAction(id, () => reorderBoatToursAction(orderedIds));
  }

  /**
   * Wraps a cell's content so drops register anywhere across the row, not
   * just over the grip handle — see this file's header comment for why
   * (AdminTable owns the <tr>, so per-cell divs are the drop targets). The
   * negative margin matches AdminTable's own td padding (px-5 py-4)
   * exactly, so the wrapper fills the whole cell with no dead zone.
   */
  function withDropZone(tourId: string, cellIndex: number, node: ReactNode) {
    const isOver = dragOverId === tourId && draggedId !== tourId;
    const isBeingDragged = draggedId === tourId;
    return (
      <div
        key={`${tourId}-${cellIndex}`}
        onDragOver={(e) => handleDragOver(e, tourId)}
        onDrop={(e) => handleDrop(e, tourId)}
        className={[
          "-mx-5 -my-4 px-5 py-4 transition-colors",
          isOver ? "bg-[var(--admin-accent)]/10 ring-1 ring-inset ring-[var(--admin-accent)]/40" : "",
          isBeingDragged ? "opacity-40" : "",
        ].join(" ")}
      >
        {node}
      </div>
    );
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-[var(--admin-ink-soft)]">
          {tours.length} tour{tours.length === 1 ? "" : "s"} in the catalog — admin-owned;
          each company chooses which to feature and in what order from Studio.
        </p>
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

      <AdminTable
        columns={["Order", "Name", "Area", "Price & duration", "Photos", "Status", "Actions"]}
        rows={ordered.map((tour) => {
          const rowPending = isPending && pendingId === tour.id;

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

          const cells: ReactNode[] = [
            <div key="order" className="flex items-center gap-2">
              <button
                type="button"
                draggable
                aria-label={`Reorder ${tour.name}`}
                onDragStart={(e) => handleDragStart(e, tour.id)}
                onDragEnd={handleDragEnd}
                onKeyDown={(e) => handleKeyboardReorder(e, tour.id)}
                className="cursor-grab touch-none text-[var(--admin-ink-soft)] transition-colors hover:text-[var(--admin-accent)] active:cursor-grabbing"
              >
                <GripVertical className="size-4" strokeWidth={2} />
              </button>
              <span className="w-5 text-sm tabular-nums text-[var(--admin-ink-soft)]">{tour.position}</span>
            </div>,
            <span key="name" className="font-medium">
              {tour.name}
            </span>,
            tour.area,
            tour.meta,
            String(tour.photos.length),
            <StatusBadge
              key="status"
              status={tour.status}
              tone={tour.status === "active" ? "positive" : "neutral"}
            />,
            <div key="actions" className="flex justify-end">
              <PortalRowMenu items={menuItems} label={`Actions for ${tour.name}`} />
            </div>,
          ];

          return cells.map((cell, cellIndex) => withDropZone(tour.id, cellIndex, cell));
        })}
        emptyMessage="No boat tours in the catalog yet. Add at least one."
      />

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--admin-ink)]/30 p-4 pt-10 backdrop-blur-[2px] sm:pt-16">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-[var(--admin-shadow-float)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-[var(--admin-ink)]">
                {editing.mode === "new" ? "Add a boat tour" : `Edit ${editing.tour.name}`}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close"
                className="text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]"
              >
                &times;
              </button>
            </div>
            <BoatTourForm
              tour={editing.mode === "edit" ? editing.tour : null}
              suggestedPosition={nextPosition}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

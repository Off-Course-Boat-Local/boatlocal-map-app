"use client";

// Admin > Boats — full CRUD for the platform boat tour catalog (PRD §8.2).
// This is the ONLY place a boat tour can be created, edited, deleted, or
// reordered — Studio's Boat tours tab (src/components/studio/
// BoatToursManager.tsx) only toggles/reorders which of these a company
// features on its own guest map, never the tour record itself.
//
// State here is optimistic for reordering (mirroring Studio's
// BoatToursManager pattern): a click reorders local state immediately,
// fires the matching Server Action, and resyncs with the server via
// router.refresh() either way, so this never silently drifts from what
// setBoatTourPosition actually persisted. Create/edit/delete go through the
// modal and rely on revalidatePath (from the Server Action) + router.refresh
// for the resulting list update.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { BoatTourRecord } from "@/lib/data/types";
import {
  deleteBoatTourAction,
  moveBoatTourAction,
} from "@/lib/admin/boatTourActions";
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

  function handleMove(id: string, direction: "up" | "down") {
    setTours((prev) => {
      const ordered = [...prev].sort((a, b) => a.position - b.position);
      const index = ordered.findIndex((t) => t.id === id);
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (index === -1 || swapIndex < 0 || swapIndex >= ordered.length) return prev;

      const current = ordered[index];
      const neighbour = ordered[swapIndex];
      return prev.map((t) => {
        if (t.id === current.id) return { ...t, position: neighbour.position };
        if (t.id === neighbour.id) return { ...t, position: current.position };
        return t;
      });
    });
    runAction(id, () => moveBoatTourAction(id, direction));
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
        <button
          type="button"
          onClick={() => setEditing({ mode: "new" })}
          className="rounded-lg bg-[var(--admin-accent-strong)] px-4 py-2 text-sm font-medium text-white"
        >
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
        rows={ordered.map((tour, index) => {
          const rowPending = isPending && pendingId === tour.id;
          return [
            <div key="order" className="flex items-center gap-2">
              <span className="text-[var(--admin-ink-soft)]">{tour.position}</span>
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`Move ${tour.name} up`}
                  disabled={index === 0 || isPending}
                  onClick={() => handleMove(tour.id, "up")}
                  className="rounded border border-[var(--admin-border)] px-1 text-xs leading-none disabled:opacity-30"
                >
                  &uarr;
                </button>
                <button
                  type="button"
                  aria-label={`Move ${tour.name} down`}
                  disabled={index === ordered.length - 1 || isPending}
                  onClick={() => handleMove(tour.id, "down")}
                  className="mt-0.5 rounded border border-[var(--admin-border)] px-1 text-xs leading-none disabled:opacity-30"
                >
                  &darr;
                </button>
              </div>
            </div>,
            tour.name,
            tour.area,
            tour.meta,
            String(tour.photos.length),
            <StatusBadge
              key="status"
              status={tour.status}
              tone={tour.status === "active" ? "positive" : "neutral"}
            />,
            <div key="actions" className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditing({ mode: "edit", tour })}
                className="text-xs font-medium text-[var(--admin-ink)] underline underline-offset-2"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(tour)}
                disabled={rowPending}
                className="text-xs font-medium text-red-600 underline underline-offset-2 disabled:opacity-50 dark:text-red-400"
              >
                {rowPending ? "…" : "Delete"}
              </button>
            </div>,
          ];
        })}
        emptyMessage="No boat tours in the catalog yet. Add at least one."
      />

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10 sm:pt-16">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--admin-ink)]">
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

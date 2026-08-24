"use client";

// Admin > Companies > [company] — "Admin recommendations for {company}"
// section: full CRUD for that one company's owner_type='admin'
// recommendations. This is the ONLY place one of these rows can be created,
// edited, deleted, or toggled — they never appear in that company's own
// Studio dashboard at all (see src/lib/data/types.ts's
// RecommendationOwnerType doc comment and
// supabase/migrations/20260824090100_admin_recommendations_rls.sql for the
// security model: invisible and uneditable in Studio by RLS, defended again
// at the app layer in src/lib/data/source.ts, and guest-visible exactly
// like any other recommendation the moment it's marked live).
//
// Modelled on src/components/admin/BoatToursManager.tsx's modal-plus-form
// convention (AdminTable + PortalRowMenu + a plain fixed-overlay modal, no
// PortalModal/dnd-kit) rather than Studio's RecommendationsManager, per this
// feature's "admin-owned equivalent, not a Studio import" requirement —
// there is no drag-reorder here (these rows have no catalog-wide position
// the way boat tours do), so this is simpler than BoatToursManager: no
// drag/keyboard-reorder state, no per-cell drop-zone wrapping.
//
// Quick visibility toggle is optimistic (flips immediately, rolls back if
// the Server Action refuses), same pattern Studio's own
// RecommendationsManager uses for the same control.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import type { RecommendationRecord } from "@/lib/data/types";
import {
  deleteAdminRecommendationAction,
  setAdminRecommendationVisibilityAction,
} from "@/lib/admin/adminRecommendationActions";
import { CATEGORY_MAP } from "@/lib/categories";
import { TrashIcon } from "@/components/PortalIcons";
import PortalRowMenu, { type PortalRowMenuItem } from "@/components/PortalRowMenu";
import PortalToggle from "@/components/PortalToggle";
import { PRIMARY_BUTTON_CLASS } from "./primitives";
import AdminTable from "./AdminTable";
import AdminRecommendationForm from "./AdminRecommendationForm";

export interface AdminRecommendationsManagerProps {
  companyId: string;
  companyName: string;
  initialRecommendations: RecommendationRecord[];
}

type EditingState =
  | { mode: "new" }
  | { mode: "edit"; recommendation: RecommendationRecord }
  | null;

export default function AdminRecommendationsManager({
  companyId,
  companyName,
  initialRecommendations,
}: AdminRecommendationsManagerProps) {
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [editing, setEditing] = useState<EditingState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Optimistic visibility overlay: id -> pending value, same shape as
  // Studio's RecommendationsManager — a toggle feels instant, a refused
  // write snaps back once the Server Action returns an error.
  const [pendingVisible, setPendingVisible] = useState<Record<string, boolean>>({});
  const router = useRouter();

  function isVisible(rec: RecommendationRecord): boolean {
    return pendingVisible[rec.id] ?? rec.visible;
  }

  async function handleToggleVisible(rec: RecommendationRecord, next: boolean) {
    setActionError(null);
    setPendingVisible((prev) => ({ ...prev, [rec.id]: next }));

    const result = await setAdminRecommendationVisibilityAction(companyId, rec.id, next);

    if (result.error) {
      setPendingVisible((prev) => {
        const rest = { ...prev };
        delete rest[rec.id];
        return rest;
      });
      setActionError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete(rec: RecommendationRecord) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Delete "${rec.name}"? This removes it from ${companyName}'s guest map. This can't be undone.`,
      )
    ) {
      return;
    }
    setActionError(null);
    setDeletingId(rec.id);
    const result = await deleteAdminRecommendationAction(companyId, rec.id);
    setDeletingId(null);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setRecommendations((prev) => prev.filter((r) => r.id !== rec.id));
    router.refresh();
  }

  function handleFormDone() {
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-[var(--admin-ink-soft)]">
          These show up on {companyName}&rsquo;s guest map and list — never in {companyName}&rsquo;s
          own Studio dashboard. {companyName} cannot see, edit, or delete these rows; only Boat
          Local staff can.
        </p>
        <button type="button" onClick={() => setEditing({ mode: "new" })} className={PRIMARY_BUTTON_CLASS}>
          <Plus className="size-4" strokeWidth={2} />
          Add recommendation
        </button>
      </div>

      {actionError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {actionError}
        </p>
      ) : null}

      <AdminTable
        columns={["Name", "Category", "Area", "Photos", "Live", "Actions"]}
        rows={recommendations.map((rec) => {
          const rowPending = deletingId === rec.id;
          const live = isVisible(rec);

          const menuItems: PortalRowMenuItem[] = [
            {
              label: "Edit",
              icon: Pencil,
              onSelect: () => setEditing({ mode: "edit", recommendation: rec }),
            },
            {
              label: "Delete",
              icon: TrashIcon,
              tone: "danger",
              disabled: rowPending,
              onSelect: () => handleDelete(rec),
            },
          ];

          return [
            <span key="name" className="font-medium">
              {rec.name}
            </span>,
            CATEGORY_MAP[rec.category]?.label ?? rec.category,
            rec.area,
            String(rec.photos.length),
            <PortalToggle
              key="live"
              size="sm"
              checked={live}
              onChange={(next) => handleToggleVisible(rec, next)}
              ariaLabel={`${live ? "Hide" : "Show"} ${rec.name} on ${companyName}'s guest map`}
            />,
            <div key="actions" className="flex justify-end">
              <PortalRowMenu items={menuItems} label={`Actions for ${rec.name}`} />
            </div>,
          ];
        })}
        emptyMessage="No admin-curated recommendations for this company yet."
      />

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--admin-ink)]/30 p-4 pt-10 backdrop-blur-[2px] sm:pt-16">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-[var(--admin-shadow-float)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-[var(--admin-ink)]">
                {editing.mode === "new" ? "Add an admin recommendation" : `Edit ${editing.recommendation.name}`}
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
            <AdminRecommendationForm
              companyId={companyId}
              recommendation={editing.mode === "edit" ? editing.recommendation : null}
              onDone={handleFormDone}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

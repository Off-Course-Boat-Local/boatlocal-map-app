"use client";

// Recommendations list + add/edit modal (PRD §7.4 company base list, §6.3
// guide personal additions), shared by both Studio roles — one page, not
// two apps.
//
// Editability mirrors saveRecommendation/deleteRecommendation's own rules
// in src/lib/data/source.ts (which mirror the RLS policies): a company may
// edit/delete only ownerType "company" rows; a guide may edit/delete only
// their own ownerType "guide" rows. Everything else renders read-only, with
// a badge, exactly like the previous read-only version of this page did.
//
// OWNER FILTER: a guide sees their own picks and the company's base list
// interleaved in one table, which gets hard to scan the moment either grows
// ("a way to quickly filter them"). The filter is client-side on purpose —
// the page already has every row it can legally see in memory, so a round
// trip per filter change would be slower and would lose the modal's state.
//
// QUICK VISIBILITY TOGGLE: each editable row can be switched on/off without
// opening the form, optimistically, rolling back if the Server Action
// refuses. Same switch component as the one at the top of the form.
//
// Uses CATEGORY_MAP directly (src/lib/categories.ts) rather than importing
// categoryLabel from src/lib/data/source.ts, so this Client Component
// doesn't pull the whole data-access module (fake store included) into the
// client bundle — the Server Component page already fetched everything
// this component needs as plain props.

import { useMemo, useState } from "react";

import PortalModal from "@/components/PortalModal";
import PortalSelect from "@/components/PortalSelect";
import PortalToggle from "@/components/PortalToggle";
import { CATEGORY_MAP } from "@/lib/categories";
import type { RecommendationRecord } from "@/lib/data/types";
import type { StudioRole } from "@/lib/studio/session";
import {
  deleteRecommendationAction,
  setRecommendationVisibilityAction,
} from "@/lib/studio/recommendationActions";
import RecommendationForm, { type RecommendationFormProps } from "./RecommendationForm";

export interface RecommendationsManagerProps {
  recommendations: RecommendationRecord[];
  role: StudioRole;
  /** Only set when role === "guide". */
  currentGuideId?: string;
  /**
   * The three actions below default to Studio's own (dev-session-gated)
   * Server Actions. Admin's /admin/default-company page passes its own
   * admin-gated equivalents instead (src/lib/admin/defaultCompanyActions.ts)
   * — same underlying source.ts calls, different session check — so this
   * one table + form serves both surfaces without a second copy of the UI.
   */
  deleteAction?: (id: string) => Promise<{ error?: string }>;
  setVisibilityAction?: (id: string, visible: boolean) => Promise<{ error?: string; visible?: boolean }>;
  saveAction?: RecommendationFormProps["saveAction"];
}

type EditingState = { mode: "new" } | { mode: "edit"; recommendation: RecommendationRecord } | null;

type OwnerFilter = "all" | "mine" | "base" | "guides";

export default function RecommendationsManager({
  recommendations,
  role,
  currentGuideId,
  deleteAction = deleteRecommendationAction,
  setVisibilityAction = setRecommendationVisibilityAction,
  saveAction,
}: RecommendationsManagerProps) {
  const [editing, setEditing] = useState<EditingState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");

  // Optimistic visibility overlay: id -> pending value. Rows read this
  // first and fall back to the server-rendered `visible`, so a toggle feels
  // instant but a refused write snaps back.
  const [pendingVisible, setPendingVisible] = useState<Record<string, boolean>>({});
  const [visibilityError, setVisibilityError] = useState<string | null>(null);

  function canEdit(rec: RecommendationRecord): boolean {
    if (role === "company") return rec.ownerType === "company";
    return rec.ownerType === "guide" && rec.guideId === currentGuideId;
  }

  // Company admins get no filter: their page is only ever their own
  // recommendations (the page narrows the rows before they reach this
  // component), so there is nothing to filter BY. A guide still sees a
  // mixed list and needs one.
  //
  // There used to also be a dedicated "Owner" column showing this same
  // company/guide-name distinction per row. Dropped it — with the filter
  // above doing that job (and the read-only badge next to a row's name
  // still marking which rows aren't editable), a whole column repeating
  // "Company" or the guide's own name down every row was redundant weight
  // on a table that's already tight on a laptop width.
  const showOwnerFilter = role === "guide";

  const filterOptions = [
    { value: "all", label: "All recommendations" },
    { value: "mine", label: "My picks" },
    { value: "base", label: "From the company" },
  ];

  const visibleRows = useMemo(() => {
    return recommendations.filter((rec) => {
      switch (ownerFilter) {
        case "mine":
          return rec.ownerType === "guide" && rec.guideId === currentGuideId;
        case "base":
          return rec.ownerType === "company";
        case "guides":
          return rec.ownerType === "guide";
        default:
          return true;
      }
    });
  }, [recommendations, ownerFilter, currentGuideId]);

  async function handleDelete(rec: RecommendationRecord) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete "${rec.name}"? This can't be undone.`)
    ) {
      return;
    }
    setDeleteError(null);
    setDeletingId(rec.id);
    const result = await deleteAction(rec.id);
    setDeletingId(null);
    if (result.error) setDeleteError(result.error);
  }

  async function handleToggleVisible(rec: RecommendationRecord, next: boolean) {
    setVisibilityError(null);
    setPendingVisible((prev) => ({ ...prev, [rec.id]: next }));

    const result = await setVisibilityAction(rec.id, next);

    if (result.error) {
      // Roll back to whatever the server last told us.
      setPendingVisible((prev) => {
        const rest = { ...prev };
        delete rest[rec.id];
        return rest;
      });
      setVisibilityError(result.error);
    }
    // On success the overlay stays until revalidatePath re-renders the page
    // with the new value, at which point overlay and prop agree anyway.
  }

  function isVisible(rec: RecommendationRecord): boolean {
    return pendingVisible[rec.id] ?? rec.visible;
  }

  const hiddenCount = recommendations.filter((r) => !isVisible(r)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Recommendations</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {role === "guide"
              ? "Your own picks, plus your company's — theirs are read-only."
              : "The places your guests see. Anything you add here goes out under your company."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing({ mode: "new" })}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Add place
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {showOwnerFilter ? (
          <div className="w-full sm:w-72">
            <PortalSelect
              name="owner-filter"
              options={filterOptions}
              defaultValue="all"
              onValueChange={(v) => setOwnerFilter(v as OwnerFilter)}
            />
          </div>
        ) : null}
        <p className="text-xs text-neutral-500">
          {showOwnerFilter
            ? `Showing ${visibleRows.length} of ${recommendations.length}`
            : `${recommendations.length} ${recommendations.length === 1 ? "place" : "places"}`}
          {hiddenCount > 0 ? ` · ${hiddenCount} hidden from guests` : ""}
        </p>
      </div>

      {deleteError ? (
        <p role="alert" className="text-sm text-red-600">
          {deleteError}
        </p>
      ) : null}
      {visibilityError ? (
        <p role="alert" className="text-sm text-red-600">
          {visibilityError}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Area</th>
              <th className="px-4 py-2 font-medium">Photos</th>
              <th className="px-4 py-2 font-medium">Live</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((rec) => {
              const editable = canEdit(rec);
              const live = isVisible(rec);
              return (
                <tr key={rec.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2 text-neutral-900">
                    {rec.name}
                    {/* Stands in for the Owner column this table used to
                        have. A guide's own rows need no label (obviously
                        theirs); their company's base-list rows get this one
                        badge, which already answers "can I edit this" —
                        exactly what the removed column's badge did. */}
                    {!editable ? (
                      <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase text-neutral-500">
                        read-only
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">
                    {CATEGORY_MAP[rec.category]?.label ?? rec.category}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{rec.area}</td>
                  <td className="px-4 py-2 text-neutral-600">{rec.photos.length}</td>
                  <td className="px-4 py-2">
                    {editable ? (
                      <PortalToggle
                        size="sm"
                        checked={live}
                        onChange={(next) => handleToggleVisible(rec, next)}
                        ariaLabel={`${live ? "Hide" : "Show"} ${rec.name} on the guest map`}
                      />
                    ) : (
                      <span className="text-xs text-neutral-400">{live ? "Yes" : "No"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {editable ? (
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setEditing({ mode: "edit", recommendation: rec })}
                          className="text-xs font-medium text-neutral-700 underline underline-offset-2"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(rec)}
                          disabled={deletingId === rec.id}
                          className="text-xs font-medium text-red-600 underline underline-offset-2 disabled:opacity-50"
                        >
                          {deletingId === rec.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {visibleRows.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-neutral-500" colSpan={6}>
                  {recommendations.length === 0
                    ? "No places yet — add your first one to put it on the guest map."
                    : "Nothing matches this filter."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* The dialog markup that used to be inline here is now
          src/components/PortalModal.tsx — one shared dialog for both
          portals, so Admin's "Create company" pop-up and this one cannot
          drift apart. See that file's header. */}
      <PortalModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={
          editing?.mode === "edit" ? `Edit ${editing.recommendation.name}` : "Add a place"
        }
      >
        {editing ? (
          <RecommendationForm
            recommendation={editing.mode === "edit" ? editing.recommendation : null}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
            saveAction={saveAction}
          />
        ) : null}
      </PortalModal>
    </div>
  );
}

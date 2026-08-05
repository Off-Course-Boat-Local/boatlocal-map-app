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
// Uses CATEGORY_MAP directly (src/lib/categories.ts) rather than importing
// categoryLabel from src/lib/data/source.ts, so this Client Component
// doesn't pull the whole data-access module (fake store included) into the
// client bundle — the Server Component page already fetched everything
// this component needs as plain props.

import { useState } from "react";

import { CATEGORY_MAP } from "@/lib/categories";
import type { RecommendationRecord } from "@/lib/data/types";
import type { StudioRole } from "@/lib/studio/session";
import { deleteRecommendationAction } from "@/lib/studio/recommendationActions";
import RecommendationForm from "./RecommendationForm";

export interface RecommendationsManagerProps {
  recommendations: RecommendationRecord[];
  /** guideId -> display name, for labelling other guides' rows in the company view. */
  guideNamesById: Record<string, string>;
  role: StudioRole;
  /** Only set when role === "guide". */
  currentGuideId?: string;
}

type EditingState = { mode: "new" } | { mode: "edit"; recommendation: RecommendationRecord } | null;

export default function RecommendationsManager({
  recommendations,
  guideNamesById,
  role,
  currentGuideId,
}: RecommendationsManagerProps) {
  const [editing, setEditing] = useState<EditingState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function canEdit(rec: RecommendationRecord): boolean {
    if (role === "company") return rec.ownerType === "company";
    return rec.ownerType === "guide" && rec.guideId === currentGuideId;
  }

  async function handleDelete(rec: RecommendationRecord) {
    if (typeof window !== "undefined" && !window.confirm(`Delete "${rec.name}"? This can't be undone.`)) {
      return;
    }
    setDeleteError(null);
    setDeletingId(rec.id);
    const result = await deleteRecommendationAction(rec.id);
    setDeletingId(null);
    if (result.error) setDeleteError(result.error);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Recommendations</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {role === "guide"
              ? "The base list below is read-only for you — only your own picks are editable."
              : "Every guide's picks, plus the base list you manage here."}
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

      {deleteError ? (
        <p role="alert" className="text-sm text-red-600">
          {deleteError}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Area</th>
              <th className="px-4 py-2 font-medium">Owner</th>
              <th className="px-4 py-2 font-medium">Photos</th>
              <th className="px-4 py-2 font-medium">Visible</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map((rec) => {
              const editable = canEdit(rec);
              const ownerLabel =
                rec.ownerType === "company"
                  ? "Base list"
                  : (guideNamesById[rec.guideId ?? ""] ?? "Guide");
              return (
                <tr key={rec.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2 text-neutral-900">{rec.name}</td>
                  <td className="px-4 py-2 text-neutral-600">
                    {CATEGORY_MAP[rec.category]?.label ?? rec.category}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{rec.area}</td>
                  <td className="px-4 py-2 text-neutral-600">
                    {ownerLabel}
                    {!editable ? (
                      <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase text-neutral-500">
                        read-only
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{rec.photos.length}</td>
                  <td className="px-4 py-2 text-neutral-600">{rec.visible ? "Yes" : "No"}</td>
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
            {recommendations.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-neutral-500" colSpan={7}>
                  Nothing here yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10 sm:pt-16">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">
                {editing.mode === "new" ? "Add a place" : `Edit ${editing.recommendation.name}`}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close"
                className="text-neutral-400 hover:text-neutral-700"
              >
                &times;
              </button>
            </div>
            <RecommendationForm
              recommendation={editing.mode === "edit" ? editing.recommendation : null}
              onDone={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

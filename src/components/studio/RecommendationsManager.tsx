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
// CARD GRID + CATEGORY FILTER: places are shown as photo cards rather than
// table rows (a place is recognised by its picture far faster than by its
// name), with category chips and a name search on top — at 200+ places a
// flat table was unscannable. Both filters are client-side, same reasoning
// as the owner filter above.
//
// Uses CATEGORY_MAP directly (src/lib/categories.ts) rather than importing
// categoryLabel from src/lib/data/source.ts, so this Client Component
// doesn't pull the whole data-access module (fake store included) into the
// client bundle — the Server Component page already fetched everything
// this component needs as plain props.

import { useMemo, useState } from "react";
import { EyeOff, ImageOff, MapPin, Mic, Pencil, Plus, Search, Trash2 } from "lucide-react";

import PortalModal from "@/components/PortalModal";
import PortalSelect from "@/components/PortalSelect";
import PortalToggle from "@/components/PortalToggle";
import { CategoryGlyph } from "@/components/map/Pin";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/categories";
import { photoUrl } from "@/lib/photoUrl";
import type { RecommendationRecord } from "@/lib/data/types";
import type { CategoryId } from "@/lib/types";
import type { StudioRole } from "@/lib/studio/session";
import {
  deleteRecommendationAction,
  setRecommendationVisibilityAction,
} from "@/lib/studio/recommendationActions";
import { GhostButton, PageHeader, PrimaryButton } from "./primitives";
import RecommendationForm, { type RecommendationFormProps } from "./RecommendationForm";
import VoiceAddPlaces from "./VoiceAddPlaces";

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

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
        active
          ? "border-[var(--studio-accent)] bg-[var(--studio-accent)] text-white"
          : "border-[var(--studio-border)] bg-[var(--studio-surface)] text-[var(--studio-ink)] hover:bg-[var(--studio-bg)]"
      }`}
    >
      {children}
    </button>
  );
}

export default function RecommendationsManager({
  recommendations,
  role,
  currentGuideId,
  deleteAction = deleteRecommendationAction,
  setVisibilityAction = setRecommendationVisibilityAction,
  saveAction,
}: RecommendationsManagerProps) {
  const [editing, setEditing] = useState<EditingState>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | null>(null);
  const [query, setQuery] = useState("");

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

  // Per-category counts for the chips, over the owner-filtered set so the
  // numbers always match what clicking the chip will show.
  const ownerRows = useMemo(() => {
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

  const categoryCounts = useMemo(() => {
    const counts = new Map<CategoryId, number>();
    for (const rec of ownerRows) for (const c of rec.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
    return CATEGORIES.filter((c) => counts.has(c.id)).map((c) => ({ ...c, count: counts.get(c.id)! }));
  }, [ownerRows]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ownerRows.filter(
      (rec) =>
        (!categoryFilter || rec.categories.includes(categoryFilter)) &&
        (!q || rec.name.toLowerCase().includes(q) || rec.area.toLowerCase().includes(q)),
    );
  }, [ownerRows, categoryFilter, query]);

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
      <PageHeader
        title="Recommendations"
        description={
          role === "guide"
            ? "Your own picks, plus your company's — theirs are read-only."
            : "The places your guests see. Anything you add here goes out under your company."
        }
        action={
          <div className="flex items-center gap-2">
            <GhostButton onClick={() => setVoiceOpen(true)}>
              <Mic className="size-4" strokeWidth={2} />
              Talk to add places
            </GhostButton>
            <PrimaryButton onClick={() => setEditing({ mode: "new" })}>
              <Plus className="size-4" strokeWidth={2} />
              Add place
            </PrimaryButton>
          </div>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative w-full sm:w-72">
            <span className="sr-only">Search places</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--studio-ink-soft)]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or area"
              className="h-10 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] pl-9 pr-3 text-sm text-[var(--studio-ink)] outline-none focus:border-[var(--studio-accent)]"
            />
          </label>
          {showOwnerFilter ? (
            <div className="w-full sm:w-64">
              <PortalSelect
                name="owner-filter"
                options={filterOptions}
                defaultValue="all"
                onValueChange={(v) => setOwnerFilter(v as OwnerFilter)}
              />
            </div>
          ) : null}
          <p className="text-xs text-[var(--studio-ink-soft)]">
            Showing {visibleRows.length} of {recommendations.length}
            {hiddenCount > 0 ? ` · ${hiddenCount} hidden from guests` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          <CategoryChip active={categoryFilter === null} onClick={() => setCategoryFilter(null)}>
            All <span className="tabular-nums opacity-70">{ownerRows.length}</span>
          </CategoryChip>
          {categoryCounts.map((cat) => {
            const active = categoryFilter === cat.id;
            return (
              <CategoryChip
                key={cat.id}
                active={active}
                onClick={() => setCategoryFilter(active ? null : cat.id)}
              >
                <CategoryGlyph category={cat.id} size={14} color={active ? "#FFFFFF" : cat.color} />
                {cat.label} <span className="tabular-nums opacity-70">{cat.count}</span>
              </CategoryChip>
            );
          })}
        </div>
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

      {visibleRows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--studio-border)] bg-[var(--studio-surface)] p-8 text-center text-sm text-[var(--studio-ink-soft)]">
          {recommendations.length === 0
            ? "No places yet — add your first one to put it on the guest map."
            : "Nothing matches this filter."}
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
          {visibleRows.map((rec) => {
            const editable = canEdit(rec);
            const live = isVisible(rec);
            const cover = rec.photos[0] ? photoUrl(rec.photos[0], { width: 480 }) : "";
            return (
              <li
                key={rec.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-[var(--studio-shadow-card)]"
              >
                {/* The photo opens the editor too — the biggest target on the card. */}
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => setEditing({ mode: "edit", recommendation: rec })}
                  aria-label={editable ? `Edit ${rec.name}` : rec.name}
                  className="relative block aspect-[4/3] w-full overflow-hidden bg-[var(--studio-bg)] enabled:cursor-pointer"
                >
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt=""
                      loading="lazy"
                      className={`h-full w-full object-cover transition-opacity ${live ? "" : "opacity-40 grayscale"}`}
                    />
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-[var(--studio-ink-soft)]">
                      <ImageOff className="size-5" aria-hidden="true" />
                      No photo yet
                    </span>
                  )}
                  {rec.photos.length > 1 ? (
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {rec.photos.length} photos
                    </span>
                  ) : null}
                  {!live ? (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white">
                      <EyeOff className="size-3" aria-hidden="true" />
                      Hidden
                    </span>
                  ) : null}
                </button>

                <div className="flex flex-1 flex-col gap-2 p-3.5">
                  <div>
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--studio-ink)]">
                      {rec.name}
                      {/* Marks the company's base-list rows on a guide's page — answers "can I edit this". */}
                      {!editable ? (
                        <span className="ml-1.5 rounded bg-[var(--studio-bg)] px-1.5 py-0.5 align-middle text-[10px] font-medium uppercase text-[var(--studio-ink-soft)]">
                          read-only
                        </span>
                      ) : null}
                    </h3>
                    {rec.area ? (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--studio-ink-soft)]">
                        <MapPin className="size-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{rec.area}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {rec.categories.map((c) => {
                      const cat = CATEGORY_MAP[c];
                      return (
                        <span
                          key={c}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ background: `${cat?.color ?? "#888888"}1A`, color: cat?.color ?? "#555555" }}
                        >
                          <CategoryGlyph category={c} size={11} color={cat?.color ?? "currentColor"} />
                          {cat?.label ?? c}
                        </span>
                      );
                    })}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--studio-border)] pt-2.5">
                    {editable ? (
                      <label className="flex items-center gap-2 text-xs text-[var(--studio-ink-soft)]">
                        <PortalToggle
                          size="sm"
                          checked={live}
                          onChange={(next) => handleToggleVisible(rec, next)}
                          ariaLabel={`${live ? "Hide" : "Show"} ${rec.name} on the guest map`}
                        />
                        {live ? "Live" : "Hidden"}
                      </label>
                    ) : (
                      <span className="text-xs text-[var(--studio-ink-soft)]">{live ? "Live" : "Hidden"}</span>
                    )}
                    {editable ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing({ mode: "edit", recommendation: rec })}
                          aria-label={`Edit ${rec.name}`}
                          className="rounded-lg p-1.5 text-[var(--studio-ink-soft)] hover:bg-[var(--studio-bg)] hover:text-[var(--studio-ink)]"
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(rec)}
                          disabled={deletingId === rec.id}
                          aria-label={`Delete ${rec.name}`}
                          className="rounded-lg p-1.5 text-[var(--studio-ink-soft)] hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

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

      <PortalModal
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        title="Talk to add places"
        maxWidthClassName="max-w-2xl"
      >
        {voiceOpen ? <VoiceAddPlaces onAllDone={() => setVoiceOpen(false)} /> : null}
      </PortalModal>
    </div>
  );
}

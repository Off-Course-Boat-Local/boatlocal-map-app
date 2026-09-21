"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Bike, Footprints, Plus, Ship, Trash2, Utensils, Compass } from "lucide-react";

import PortalModal from "@/components/PortalModal";
import type { BoatTourRecord, SaveBoatTourInput } from "@/lib/data/types";
import type { TourTransportType } from "@/lib/types";
import { moveBoatFeaturedAction, toggleBoatFeaturedAction } from "@/lib/studio/boatTourActions";
import { deleteCustomTourAction, saveCustomTourAction } from "@/lib/studio/tourActions";
import { GhostButton, PrimaryButton, SectionHeading, TableShell } from "./primitives";
import CustomTourForm from "./CustomTourForm";

export type StudioBoatTourRow = BoatTourRecord & {
  isFeatured: boolean;
  featuredPosition: number;
};

const TYPE_ICONS: Record<TourTransportType, typeof Ship> = {
  boat: Ship,
  bike: Bike,
  walk: Footprints,
  food: Utensils,
  other: Compass,
};

export default function BoatToursManager({
  initialCatalog,
}: {
  initialCatalog: StudioBoatTourRow[];
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editingCustomTour, setEditingCustomTour] = useState<BoatTourRecord | null | "new">(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Custom tours are owned by the company (companyId is not null)
  const customTours = catalog.filter((t) => !!t.companyId);
  // Catalog tours are platform tours
  const catalogTours = catalog.filter((t) => !t.companyId);

  const featured = catalogTours
    .filter((t) => t.isFeatured)
    .sort((a, b) => a.featuredPosition - b.featuredPosition);
  const rest = catalogTours.filter((t) => !t.isFeatured);

  function runAction(id: string, run: () => Promise<void>) {
    setPendingId(id);
    startTransition(async () => {
      try {
        await run();
      } finally {
        router.refresh();
        setPendingId(null);
      }
    });
  }

  function handleToggle(id: string, isFeatured: boolean) {
    setCatalog((prev) => {
      if (isFeatured) {
        const maxPosition = prev
          .filter((t) => t.isFeatured)
          .reduce((max, t) => Math.max(max, t.featuredPosition), 0);
        return prev.map((t) =>
          t.id === id ? { ...t, isFeatured: true, featuredPosition: maxPosition + 1 } : t,
        );
      }
      return prev.map((t) => (t.id === id ? { ...t, isFeatured: false } : t));
    });
    runAction(id, () => toggleBoatFeaturedAction(id, isFeatured));
  }

  function handleMove(id: string, direction: "up" | "down") {
    setCatalog((prev) => {
      const ordered = prev
        .filter((t) => t.isFeatured)
        .sort((a, b) => a.featuredPosition - b.featuredPosition);
      const index = ordered.findIndex((t) => t.id === id);
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (index === -1 || swapIndex < 0 || swapIndex >= ordered.length) return prev;

      const current = ordered[index];
      const neighbour = ordered[swapIndex];
      return prev.map((t) => {
        if (t.id === current.id) return { ...t, featuredPosition: neighbour.featuredPosition };
        if (t.id === neighbour.id) return { ...t, featuredPosition: current.featuredPosition };
        return t;
      });
    });
    runAction(id, () => moveBoatFeaturedAction(id, direction));
  }

  async function handleSaveCustomTour(input: SaveBoatTourInput) {
    const res = await saveCustomTourAction(input);
    if (res.error) throw new Error(res.error);
    if (res.tour) {
      const saved = res.tour;
      setCatalog((prev) => {
        const existingIdx = prev.findIndex((t) => t.id === saved.id);
        const row: StudioBoatTourRow = {
          ...saved,
          isFeatured: true,
          featuredPosition: saved.position,
        };
        if (existingIdx >= 0) {
          const copy = [...prev];
          copy[existingIdx] = row;
          return copy;
        }
        return [...prev, row];
      });
      setEditingCustomTour(null);
      router.refresh();
    }
  }

  async function handleDeleteCustomTour(id: string) {
    if (!confirm("Are you sure you want to delete this custom tour?")) return;
    const res = await deleteCustomTourAction(id);
    if (res.error) {
      setError(res.error);
    } else {
      setCatalog((prev) => prev.filter((t) => t.id !== id));
      router.refresh();
    }
  }

  return (
    <div className="space-y-10">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Operator Custom Tours */}
      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeading
            title={`Your Tours & Experiences (${customTours.length})`}
            description="Tours owned and operated directly by your company (boat tours, bike tours, walking tours, food tastings)."
          />
          <PrimaryButton onClick={() => setEditingCustomTour("new")}>
            <Plus size={16} className="mr-1.5 inline" />
            Add Custom Tour
          </PrimaryButton>
        </div>

        <div className="mt-4">
          <TableShell
            head={
              <>
                <th>Tour</th>
                <th>Type</th>
                <th>Departure Area</th>
                <th>Details / Pricing</th>
                <th className="w-32 text-right">Actions</th>
              </>
            }
          >
            {customTours.map((tour) => {
              const tourType: TourTransportType = tour.tourType ?? "boat";
              const Icon = TYPE_ICONS[tourType] ?? Ship;

              return (
                <tr key={tour.id}>
                  <td className="font-medium text-[var(--studio-ink)]">{tour.name}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--studio-border)] bg-[var(--studio-bg)] px-2.5 py-0.5 text-xs capitalize text-[var(--studio-ink)]">
                      <Icon size={12} />
                      {tourType}
                    </span>
                  </td>
                  <td className="text-[var(--studio-ink-soft)]">{tour.area}</td>
                  <td className="text-[var(--studio-ink-soft)]">{tour.meta}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <GhostButton size="sm" onClick={() => setEditingCustomTour(tour)}>
                        Edit
                      </GhostButton>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomTour(tour.id)}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        title="Delete custom tour"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {customTours.length === 0 ? (
              <tr>
                <td className="text-[var(--studio-ink-soft)]" colSpan={5}>
                  No custom tours created yet. Click "Add Custom Tour" above to add your own tours.
                </td>
              </tr>
            ) : null}
          </TableShell>
        </div>
      </section>

      {/* Featured Partner Catalog Tours */}
      <section>
        <SectionHeading
          title={`Featured Partner Boat Tours (${featured.length})`}
          description="This is the order partner tours appear in the guest Boats carousel."
        />

        <div className="mt-4">
          <TableShell
            head={
              <>
                <th className="w-16">Order</th>
                <th>Tour</th>
                <th>Area</th>
                <th>Details</th>
                <th className="w-28">Reorder</th>
                <th className="w-24">Featured</th>
              </>
            }
          >
            {featured.map((tour, index) => {
              const rowPending = isPending && pendingId === tour.id;
              return (
                <tr key={tour.id}>
                  <td className="text-[var(--studio-ink-soft)] tabular-nums">#{index + 1}</td>
                  <td className="font-medium text-[var(--studio-ink)]">{tour.name}</td>
                  <td className="text-[var(--studio-ink-soft)]">{tour.area}</td>
                  <td className="text-[var(--studio-ink-soft)]">{tour.meta}</td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label={`Move ${tour.name} up`}
                        disabled={index === 0 || isPending}
                        onClick={() => handleMove(tour.id, "up")}
                        className="grid size-7 place-items-center rounded-lg border border-[var(--studio-border)] text-[var(--studio-ink)] transition-colors hover:bg-[var(--studio-bg)] disabled:opacity-30"
                      >
                        <ArrowUp className="size-3.5" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${tour.name} down`}
                        disabled={index === featured.length - 1 || isPending}
                        onClick={() => handleMove(tour.id, "down")}
                        className="grid size-7 place-items-center rounded-lg border border-[var(--studio-border)] text-[var(--studio-ink)] transition-colors hover:bg-[var(--studio-bg)] disabled:opacity-30"
                      >
                        <ArrowDown className="size-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggle(tour.id, false)}
                      className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition-opacity disabled:opacity-50"
                    >
                      {rowPending ? "…" : "Remove"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {featured.length === 0 ? (
              <tr>
                <td className="text-[var(--studio-ink-soft)]" colSpan={6}>
                  Nothing featured yet — add tours from the catalog below.
                </td>
              </tr>
            ) : null}
          </TableShell>
        </div>
      </section>

      {/* Rest of Catalog */}
      <section>
        <SectionHeading
          title={`Rest of Catalog (${rest.length})`}
          description="Boat Local's full tour catalog. Admin manages the tours themselves; you choose which appear on your guide's map."
        />

        <div className="mt-4">
          <TableShell
            head={
              <>
                <th>Tour</th>
                <th>Area</th>
                <th>Details</th>
                <th className="w-24">Featured</th>
              </>
            }
          >
            {rest.map((tour) => {
              const rowPending = isPending && pendingId === tour.id;
              return (
                <tr key={tour.id}>
                  <td className="font-medium text-[var(--studio-ink)]">{tour.name}</td>
                  <td className="text-[var(--studio-ink-soft)]">{tour.area}</td>
                  <td className="text-[var(--studio-ink-soft)]">{tour.meta}</td>
                  <td>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggle(tour.id, true)}
                      className="rounded-lg bg-[var(--studio-accent)] px-2.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {rowPending ? "…" : "Add"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {rest.length === 0 ? (
              <tr>
                <td className="text-[var(--studio-ink-soft)]" colSpan={4}>
                  Every tour in the catalog is already featured.
                </td>
              </tr>
            ) : null}
          </TableShell>
        </div>
      </section>

      {/* Custom Tour Modal */}
      {editingCustomTour && (
        <PortalModal
          open={true}
          onClose={() => setEditingCustomTour(null)}
          title={editingCustomTour === "new" ? "Add Custom Tour" : "Edit Tour"}
        >
          <CustomTourForm
            initialTour={editingCustomTour === "new" ? null : editingCustomTour}
            onSave={handleSaveCustomTour}
            onCancel={() => setEditingCustomTour(null)}
          />
        </PortalModal>
      )}
    </div>
  );
}

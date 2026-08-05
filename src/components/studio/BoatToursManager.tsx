"use client";

// Studio > Boat tours (PRD §7.5, company-only). Shows Boat Local's whole
// catalog with a per-tour "featured" toggle, plus arrow re-ordering of the
// featured subset — the order guests actually see on the map (see
// getBoatTours' comment in src/lib/data/source.ts for why that's the
// tenant's own featured position, not the catalog's global one). No
// create/edit of the underlying tour here — that's Admin-only (PRD §8.2).
//
// State here is optimistic: a click updates local state immediately, fires
// the matching Server Action (src/lib/studio/boatTourActions.ts), and
// resyncs with the server on success/failure via router.refresh() so this
// never silently drifts from what setBoatFeature actually persisted.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { BoatTourRecord } from "@/lib/data/types";
import { moveBoatFeaturedAction, toggleBoatFeaturedAction } from "@/lib/studio/boatTourActions";

export type StudioBoatTourRow = BoatTourRecord & {
  isFeatured: boolean;
  featuredPosition: number;
};

export default function BoatToursManager({
  initialCatalog,
}: {
  initialCatalog: StudioBoatTourRow[];
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const router = useRouter();

  const featured = catalog
    .filter((t) => t.isFeatured)
    .sort((a, b) => a.featuredPosition - b.featuredPosition);
  const rest = catalog.filter((t) => !t.isFeatured);

  function runAction(id: string, run: () => Promise<void>) {
    setPendingId(id);
    startTransition(async () => {
      try {
        await run();
      } finally {
        // Resync with the server's actual state either way — cheap
        // insurance against optimistic state drifting from what the
        // fake store (or, later, Supabase) actually persisted.
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

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Featured on your map ({featured.length})
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          This is the order guests see in the Boats carousel. Boats always
          show first, ahead of every other category.
        </p>

        <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="w-16 px-4 py-2 font-medium">Order</th>
                <th className="px-4 py-2 font-medium">Tour</th>
                <th className="px-4 py-2 font-medium">Area</th>
                <th className="px-4 py-2 font-medium">Details</th>
                <th className="w-28 px-4 py-2 font-medium">Reorder</th>
                <th className="w-24 px-4 py-2 font-medium">Featured</th>
              </tr>
            </thead>
            <tbody>
              {featured.map((tour, index) => {
                const rowPending = isPending && pendingId === tour.id;
                return (
                  <tr key={tour.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2 text-neutral-500">#{index + 1}</td>
                    <td className="px-4 py-2 text-neutral-900">{tour.name}</td>
                    <td className="px-4 py-2 text-neutral-600">{tour.area}</td>
                    <td className="px-4 py-2 text-neutral-600">{tour.meta}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          aria-label={`Move ${tour.name} up`}
                          disabled={index === 0 || isPending}
                          onClick={() => handleMove(tour.id, "up")}
                          className="rounded border border-neutral-300 px-1.5 py-0.5 text-neutral-700 disabled:opacity-30"
                        >
                          &uarr;
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${tour.name} down`}
                          disabled={index === featured.length - 1 || isPending}
                          onClick={() => handleMove(tour.id, "down")}
                          className="rounded border border-neutral-300 px-1.5 py-0.5 text-neutral-700 disabled:opacity-30"
                        >
                          &darr;
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleToggle(tour.id, false)}
                        className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 disabled:opacity-50"
                      >
                        {rowPending ? "…" : "Remove"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {featured.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-neutral-500" colSpan={6}>
                    Nothing featured yet — add tours from the catalog below.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Rest of the catalog ({rest.length})
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Boat Local&rsquo;s full tour catalog. Admin manages the tours
          themselves; you choose which appear on your guide&rsquo;s map.
        </p>

        <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Tour</th>
                <th className="px-4 py-2 font-medium">Area</th>
                <th className="px-4 py-2 font-medium">Details</th>
                <th className="w-24 px-4 py-2 font-medium">Featured</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((tour) => {
                const rowPending = isPending && pendingId === tour.id;
                return (
                  <tr key={tour.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2 text-neutral-900">{tour.name}</td>
                    <td className="px-4 py-2 text-neutral-600">{tour.area}</td>
                    <td className="px-4 py-2 text-neutral-600">{tour.meta}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleToggle(tour.id, true)}
                        className="rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {rowPending ? "…" : "Add"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rest.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-neutral-500" colSpan={4}>
                    Every tour in the catalog is already featured.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

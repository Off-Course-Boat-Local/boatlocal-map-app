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
import { ArrowDown, ArrowUp } from "lucide-react";

import type { BoatTourRecord } from "@/lib/data/types";
import { moveBoatFeaturedAction, toggleBoatFeaturedAction } from "@/lib/studio/boatTourActions";
import { SectionHeading, TableShell } from "./primitives";

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
    <div className="space-y-8">
      <section>
        <SectionHeading
          title={`Featured on your map (${featured.length})`}
          description="This is the order guests see in the Boats carousel. Boats always show first, ahead of every other category."
        />

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
      </section>

      <section>
        <SectionHeading
          title={`Rest of the catalog (${rest.length})`}
          description="Boat Local's full tour catalog. Admin manages the tours themselves; you choose which appear on your guide's map."
        />

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
      </section>
    </div>
  );
}

"use client";

// "Search Google Maps" enrichment for AdminRecommendationForm — searches
// Google Places (New) for whatever's currently typed in the Name field
// (always Amsterdam-biased, see src/lib/admin/googlePlaces.ts), shows the
// candidates, and on pick fetches full details (address/area/coords/hours/
// category guess/up to 8 photos) for the parent form to drop into its
// fields.
//
// This is the one place in the app that talks to Google Places — see
// googlePlaces.ts's header comment for why (a deliberate, scoped override
// of the house rule documented in src/lib/studio/geocode.ts). Nothing else
// changes: the Address field below this one still searches Photon/OSM.

import { useState } from "react";
import { Loader2, Search } from "lucide-react";

import { FIELD_CLASS } from "./primitives";
import type { PlaceDetails, PlaceSearchResult } from "@/lib/admin/googlePlaces";

export interface GooglePlaceSearchFieldProps {
  /** Current Name field value — this is the query, not a separate typed field. */
  query: string;
  onApply: (details: PlaceDetails) => void;
}

export default function GooglePlaceSearchField({ query, onApply }: GooglePlaceSearchFieldProps) {
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2) {
      setError("Type a name above first.");
      return;
    }
    setSearching(true);
    setError(null);
    setOpen(true);
    try {
      const res = await fetch(`/api/admin/places/search?q=${encodeURIComponent(q)}`);
      const body = (await res.json()) as { results?: PlaceSearchResult[]; error?: string };
      setResults(body.results ?? []);
      if (body.error) setError(body.error);
    } catch {
      setError("Google search is unavailable right now.");
    } finally {
      setSearching(false);
    }
  }

  async function pick(placeId: string) {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/places/details?placeId=${encodeURIComponent(placeId)}`);
      const body = (await res.json()) as { details?: PlaceDetails; error?: string };
      if (body.details) {
        onApply(body.details);
        setOpen(false);
        setResults([]);
      } else {
        setError(body.error ?? "Couldn't load that place's details.");
      }
    } catch {
      setError("Couldn't load that place's details.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={runSearch}
        disabled={searching || applying}
        className={`${FIELD_CLASS} flex w-full items-center justify-center gap-2 !bg-[var(--admin-bg)] font-medium hover:opacity-90 disabled:opacity-60`}
      >
        {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        Search Google Maps
      </button>

      {error ? <p className="text-xs text-amber-700">{error}</p> : null}

      {open && results.length > 0 ? (
        <ul
          role="listbox"
          className="max-h-64 overflow-y-auto rounded-xl border py-1 shadow-lg"
          style={{ borderColor: "var(--admin-border)", backgroundColor: "var(--admin-surface)" }}
        >
          {results.map((r) => (
            <li key={r.placeId}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                disabled={applying}
                onClick={() => pick(r.placeId)}
                className="block w-full px-3 py-2 text-left hover:bg-[var(--admin-nav-active-bg)] disabled:opacity-60"
              >
                <span className="block truncate text-sm font-medium text-[var(--admin-ink)]">{r.name}</span>
                {r.address ? (
                  <span className="block truncate text-xs text-[var(--admin-ink-soft)]">{r.address}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open && !searching && results.length === 0 && !error ? (
        <p className="text-xs text-[var(--admin-ink-soft)]">No matches near Amsterdam.</p>
      ) : null}

      {applying ? (
        <p className="text-xs text-[var(--admin-ink-soft)]">Pulling hours, category, and photos…</p>
      ) : null}
    </div>
  );
}

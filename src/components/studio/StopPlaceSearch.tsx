"use client";

// "Search Google Maps" for one stop/venue. Searches by the name typed in the
// field above; on pick hands back name/address/coords straight from the
// search response (no Details call, so no photo downloads). Same
// Studio-gated /api/studio/places/search route as GooglePlaceSearchField.
//
// `auto` turns it into type-ahead: results appear (debounced) as the person
// types, with no button. Without it, it's the explicit button.

import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";

import type { PlaceSearchResult } from "@/lib/admin/googlePlaces";

export interface StopPlaceSearchProps {
  query: string;
  onPick: (place: PlaceSearchResult) => void;
  auto?: boolean;
}

const DEBOUNCE_MS = 350;
const MIN_AUTO_CHARS = 3;

export default function StopPlaceSearch({
  query,
  onPick,
  auto = false,
}: StopPlaceSearchProps) {
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // The name last filled in by a pick — typing that back into the field
  // must not immediately re-open the list.
  const pickedQueryRef = useRef<string | null>(null);

  async function runSearch(q: string, signal?: AbortSignal) {
    setSearching(true);
    setError(null);
    setOpen(true);
    try {
      const res = await fetch(
        `/api/studio/places/search?q=${encodeURIComponent(q)}`,
        { signal },
      );
      const body = (await res.json()) as {
        results?: PlaceSearchResult[];
        error?: string;
      };
      setResults(body.results ?? []);
      if (body.error) setError(body.error);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setError("Google search is unavailable right now.");
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (!auto) return;
    const q = query.trim();
    if (q.length < MIN_AUTO_CHARS || q === pickedQueryRef.current) {
      setOpen(false);
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(
      () => void runSearch(q, controller.signal),
      DEBOUNCE_MS,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [auto, query]);

  function handleManualClick() {
    const q = query.trim();
    if (q.length < 2) {
      setError("Type a name above first.");
      return;
    }
    void runSearch(q);
  }

  return (
    <div className="space-y-1.5">
      {auto ? null : (
        <button
          type="button"
          onClick={handleManualClick}
          disabled={searching}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--studio-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--studio-ink)] hover:opacity-80 disabled:opacity-60"
        >
          {searching ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Search className="size-3.5" />
          )}
          Search Google Maps
        </button>
      )}

      {auto && searching ? (
        <p className="flex items-center gap-1.5 text-xs text-[var(--studio-ink-soft)]">
          <Loader2 className="size-3 animate-spin" /> Searching Google Maps…
        </p>
      ) : null}

      {error ? <p className="text-xs text-amber-700">{error}</p> : null}

      {open && results.length > 0 ? (
        <ul
          role="listbox"
          className="max-h-56 overflow-y-auto rounded-xl border py-1 shadow-lg"
          style={{
            borderColor: "var(--studio-border)",
            backgroundColor: "var(--studio-surface)",
          }}
        >
          {results.map((r) => (
            <li key={r.placeId}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  pickedQueryRef.current = r.name.trim();
                  onPick(r);
                  setOpen(false);
                  setResults([]);
                }}
                className="block w-full px-3 py-2 text-left hover:bg-[var(--studio-bg)]"
              >
                <span className="block truncate text-sm font-medium text-[var(--studio-ink)]">
                  {r.name}
                </span>
                {r.address ? (
                  <span className="block truncate text-xs text-[var(--studio-ink-soft)]">
                    {r.address}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open && !searching && results.length === 0 && !error ? (
        <p className="text-xs text-[var(--studio-ink-soft)]">
          No matches near Amsterdam.
        </p>
      ) : null}
    </div>
  );
}

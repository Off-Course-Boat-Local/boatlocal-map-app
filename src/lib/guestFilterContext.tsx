"use client";

// Category filter shared between the Map and List guest screens.
//
// Map and List are separate routes (/map, /list), not tabs inside one
// component, so their filter state can't just be a shared `useState` unless
// something above both of them holds it. src/app/(guest)/layout.tsx wraps
// every guest route and — being the same layout instance — stays mounted
// across client-side navigation between sibling routes in the App Router,
// so a Context provider planted there is a natural, "easy" home for this:
// no new persistence layer, no URL param, no server round-trip, and the
// filter survives a Map -> List -> Map hop exactly the way a guest expects
// ("I picked Coffee, why did List reset to everything?").
//
// It intentionally does NOT persist to localStorage/sessionStorage: unlike
// Saved (src/lib/savedPlaces.ts), there's no product reason for a filter
// choice to survive a full page reload or a new visit — it's transient
// browsing state, not something worth carrying to Saved's localStorage.
//
// Falls back to local (per-consumer) state if ever rendered outside the
// provider, so a screen doesn't hard-crash if it's used standalone (e.g. in
// a test) — it just won't share the filter with anything else in that case.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CategoryId } from "./types";

export interface GuestFilterContextValue {
  /** `null` means "All". */
  filter: CategoryId | null;
  setFilter: (next: CategoryId | null) => void;
}

const GuestFilterContext = createContext<GuestFilterContextValue | null>(null);

export function GuestFilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<CategoryId | null>(null);
  const value = useMemo(() => ({ filter, setFilter }), [filter]);
  return (
    <GuestFilterContext.Provider value={value}>{children}</GuestFilterContext.Provider>
  );
}

export function useGuestFilter(): GuestFilterContextValue {
  const ctx = useContext(GuestFilterContext);
  // Hooks must run unconditionally regardless of which branch is taken below.
  const [localFilter, setLocalFilter] = useState<CategoryId | null>(null);
  return ctx ?? { filter: localFilter, setFilter: setLocalFilter };
}

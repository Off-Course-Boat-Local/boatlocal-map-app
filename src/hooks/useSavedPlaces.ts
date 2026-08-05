"use client";

// React binding over src/lib/savedPlaces.ts's localStorage helpers.
//
// Built on useSyncExternalStore rather than useState + a manual re-sync
// effect: the saved list is external state (localStorage), and this is the
// API React ships specifically for subscribing a component to state that
// lives outside React while staying correct across SSR (server always sees
// "nothing saved" — getServerSnapshot below) and hydration. Every consumer
// (bottom nav badge, list heart, saved screen) reads the same live snapshot
// with no shared React state of their own.
//
// savedPlaces.ts's getSavedPlaceIds() is deliberately cached to return the
// same array reference until something actually changes — required here,
// since useSyncExternalStore's getSnapshot must be referentially stable or
// React treats every render as a store change and throws.

import { useCallback, useSyncExternalStore } from "react";

import {
  addSavedPlace,
  getSavedPlaceIds,
  removeSavedPlace,
  subscribeSavedPlaces,
  toggleSavedPlace,
} from "@/lib/savedPlaces";

export interface UseSavedPlacesResult {
  /** Saved ids, in save order. Empty (and stable) during SSR/first paint. */
  savedIds: string[];
  /** Convenience count for badges — same as savedIds.length. */
  count: number;
  isSaved: (id: string) => boolean;
  save: (id: string) => void;
  unsave: (id: string) => void;
  toggle: (id: string) => void;
}

const EMPTY_IDS: string[] = [];

function getServerSnapshot(): string[] {
  return EMPTY_IDS;
}

export function useSavedPlaces(): UseSavedPlacesResult {
  const savedIds = useSyncExternalStore(subscribeSavedPlaces, getSavedPlaceIds, getServerSnapshot);

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  const save = useCallback((id: string) => {
    addSavedPlace(id);
  }, []);
  const unsave = useCallback((id: string) => {
    removeSavedPlace(id);
  }, []);
  const toggle = useCallback((id: string) => {
    toggleSavedPlace(id);
  }, []);

  return { savedIds, count: savedIds.length, isSaved, save, unsave, toggle };
}

// Category config — pin colour + Lucide icon per category.
//
// Category colours are deliberately NOT brand colours: a guest needs to read
// "that's food, that's a boat" at a glance, and that meaning must survive a
// re-skin. Only the active filter pill and chrome take the brand colour.
//
// The palette is tuned to stay clear of all five brand primaries in
// src/lib/brand.ts — an exact collision (e.g. a blue boat pin on a blue-brand
// app) makes the category signal disappear for that tenant. It is also tuned
// for separation *between* categories at 36px pin size, where three adjacent
// oranges are indistinguishable and the glyph ends up doing all the work.
//
// ICONS: Lucide components (one icon language across the whole product —
// see src/lib/types.ts's Category.glyph comment), replacing the hand-drawn
// 24x24 paths this file started with after the founder's UI audit called
// those out. Pick icons that stay legible when drawn ~15px tall inside a
// pin head — simple silhouettes, no fine interior detail.
//
// NOTE: the final category set is still open (PRD §15 #2). This set matches
// the pins visible in prototype 2. Changing it should mean editing this file
// and nothing else.

import {
  Camera,
  Coffee,
  Croissant,
  Landmark,
  Martini,
  Music,
  Sailboat,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";

import type { Category, CategoryId } from "./types";

export const CATEGORIES: Category[] = [
  { id: "boats", label: "Boats", color: "#0F6FA6", glyph: Sailboat },
  { id: "breakfast", label: "Breakfast", color: "#B5741A", glyph: Croissant },
  { id: "lunch", label: "Lunch", color: "#D9552B", glyph: UtensilsCrossed },
  { id: "coffee", label: "Coffee", color: "#7A5230", glyph: Coffee },
  { id: "drinks", label: "Drinks", color: "#8E2F8F", glyph: Martini },
  { id: "dancing", label: "Dancing", color: "#D6259C", glyph: Music },
  { id: "see", label: "See", color: "#5B4BC4", glyph: Landmark },
  { id: "photo", label: "Photo spot", color: "#54A81E", glyph: Camera },
  { id: "shop", label: "Shop", color: "#A83A5E", glyph: ShoppingBag },
];

export const CATEGORY_MAP: Record<CategoryId, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, Category>;

export function categoryColor(id: CategoryId): string {
  return CATEGORY_MAP[id]?.color ?? "#666666";
}

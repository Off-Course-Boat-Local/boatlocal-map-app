// Category config — pin colour + glyph per category.
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
// NOTE: the final category set is still open (PRD §15 #2). This set matches
// the pins visible in prototype 2. Changing it should mean editing this file
// and nothing else.

import type { Category, CategoryId } from "./types";

export const CATEGORIES: Category[] = [
  {
    id: "boats",
    label: "Boats",
    color: "#0F6FA6",
    // sailboat
    glyph:
      "M12 3v8H6l6-8zm1 0v8h5l-5-8zM3.5 14h17l-2.2 4.2a3 3 0 0 1-2.7 1.6H8.4a3 3 0 0 1-2.7-1.6L3.5 14z",
  },
  {
    id: "breakfast",
    label: "Breakfast",
    color: "#B5741A",
    // fried egg / dome
    glyph:
      "M3 17h18a1 1 0 0 1 0 2H3a1 1 0 0 1 0-2zm9-11a7 7 0 0 1 7 7v1H5v-1a7 7 0 0 1 7-7z",
  },
  {
    id: "lunch",
    label: "Lunch",
    color: "#D9552B",
    // fork & knife
    glyph:
      "M7 2v8a2 2 0 0 0 2 2v10h2V12a2 2 0 0 0 2-2V2h-1.5v7h-1V2h-1v7h-1V2H7zm9 0c-1.5 1-2.5 3-2.5 6 0 2 1 3.5 2 4v10H18V2h-2z",
  },
  {
    id: "coffee",
    label: "Coffee",
    color: "#7A5230",
    // cup
    glyph:
      "M4 6h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V6zm13 1.5h1.5a2.5 2.5 0 0 1 0 5H17v-5zM3 19h15a1 1 0 0 1 0 2H3a1 1 0 0 1 0-2z",
  },
  {
    id: "drinks",
    label: "Drinks",
    color: "#8E2F8F",
    // cocktail
    glyph: "M3 4h18l-8 9v6h4v2H7v-2h4v-6L3 4zm3.2 2 2 2h7.6l2-2H6.2z",
  },
  {
    id: "see",
    label: "See",
    color: "#5B4BC4",
    // museum
    glyph:
      "M12 2 2 8v2h20V8L12 2zM5 11h2.5v7H5v-7zm5.75 0h2.5v7h-2.5v-7zM16.5 11H19v7h-2.5v-7zM3 19h18v2H3v-2z",
  },
  {
    id: "photo",
    label: "Photo spot",
    color: "#54A81E",
    // camera
    glyph:
      "M9 4h6l1.2 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.8L9 4zm3 5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z",
  },
  {
    id: "shop",
    label: "Shop",
    color: "#A83A5E",
    // bag
    glyph:
      "M8 7V6a4 4 0 1 1 8 0v1h3l1 14H4L5 7h3zm2 0h4V6a2 2 0 1 0-4 0v1z",
  },
];

export const CATEGORY_MAP: Record<CategoryId, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, Category>;

export function categoryColor(id: CategoryId): string {
  return CATEGORY_MAP[id]?.color ?? "#666666";
}

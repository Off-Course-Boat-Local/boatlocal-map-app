"use client";

import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";

export const POPULAR_CUISINES = [
  "Dutch",
  "Indonesian",
  "Surinamese",
  "Italian",
  "French",
  "Japanese",
  "Sushi",
  "Ramen",
  "Mexican",
  "Thai",
  "Vietnamese",
  "Chinese",
  "Indian",
  "Mediterranean",
  "Middle Eastern",
  "Spanish / Tapas",
  "Seafood",
  "Pancakes",
  "Bakery",
  "Sandwiches",
  "Street Food",
  "Vegan / Vegetarian",
  "Craft Beer",
];

export interface CuisineTagFieldProps {
  value: string[];
  onChange: (cuisines: string[]) => void;
  suggested?: string[];
  name?: string;
  theme?: "studio" | "admin";
}

export default function CuisineTagField({
  value,
  onChange,
  suggested = [],
  name = "cuisineTypes",
  theme = "studio",
}: CuisineTagFieldProps) {
  const [customInput, setCustomInput] = useState("");

  const accentColor = theme === "admin" ? "var(--admin-accent)" : "var(--studio-accent)";
  const borderColor = theme === "admin" ? "var(--admin-border)" : "var(--studio-border)";
  const bgColor = theme === "admin" ? "var(--admin-bg)" : "var(--studio-bg)";
  const inkColor = theme === "admin" ? "var(--admin-ink)" : "var(--studio-ink)";
  const mutedColor = theme === "admin" ? "var(--admin-ink-soft)" : "var(--studio-ink-soft)";

  function toggleCuisine(cuisine: string) {
    if (value.includes(cuisine)) {
      onChange(value.filter((c) => c !== cuisine));
    } else {
      onChange([...value, cuisine]);
    }
  }

  function addCustomCuisine() {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (!value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setCustomInput("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCustomCuisine();
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--studio-ink-soft)]">
          Cuisine / Speciality Sub-labels
        </label>
        <span className="text-xs text-[var(--studio-ink-soft)]">
          e.g. Dutch, Indonesian, Street Food
        </span>
      </div>

      {/* Hidden inputs for form submission */}
      {value.map((c) => (
        <input key={c} type="hidden" name={name} value={c} />
      ))}

      {/* Selected tags badges */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {value.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-xs"
              style={{
                borderColor: accentColor,
                backgroundColor: `${accentColor}18`,
                color: accentColor,
              }}
            >
              {c}
              <button
                type="button"
                onClick={() => toggleCuisine(c)}
                aria-label={`Remove ${c}`}
                className="grid size-3.5 place-items-center rounded-full hover:opacity-75"
              >
                <X className="size-3" strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Quick select presets */}
      <div className="flex flex-wrap gap-1.5">
        {POPULAR_CUISINES.map((cuisine) => {
          const isSelected = value.includes(cuisine);
          const isSuggested = suggested.includes(cuisine);
          if (isSelected) return null; // Already shown in selected tags above

          return (
            <button
              key={cuisine}
              type="button"
              onClick={() => toggleCuisine(cuisine)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                isSuggested ? "ring-1 ring-amber-400 font-semibold" : ""
              }`}
              style={{
                borderColor,
                color: isSuggested ? inkColor : mutedColor,
                backgroundColor: isSuggested ? `${bgColor}` : "transparent",
              }}
            >
              <Plus className="size-3" strokeWidth={2} />
              {cuisine}
            </button>
          );
        })}
      </div>

      {/* Custom cuisine text add */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add other cuisine (e.g. Surinamese, Tapas)..."
          className="h-8.5 flex-1 rounded-lg border px-3 text-xs outline-none transition-colors focus:border-[var(--studio-accent)]"
          style={{
            borderColor,
            backgroundColor: bgColor,
            color: inkColor,
          }}
        />
        <button
          type="button"
          onClick={addCustomCuisine}
          disabled={!customInput.trim()}
          className="inline-flex h-8.5 items-center rounded-lg border px-3 text-xs font-semibold transition-opacity disabled:opacity-40"
          style={{
            borderColor,
            color: inkColor,
            backgroundColor: bgColor,
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

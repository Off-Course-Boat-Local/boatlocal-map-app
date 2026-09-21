"use client";

import { useState } from "react";
import { Bike, Footprints, Ship, Utensils, Compass } from "lucide-react";
import type { BoatTourRecord, SaveBoatTourInput } from "@/lib/data/types";
import type { TourTransportType } from "@/lib/types";
import { GhostButton, PrimaryButton, inputClass, labelClass } from "./primitives";

export interface CustomTourFormProps {
  initialTour?: BoatTourRecord | null;
  onSave: (input: SaveBoatTourInput) => Promise<void>;
  onCancel: () => void;
}

const TOUR_TYPES: { type: TourTransportType; label: string; icon: typeof Ship }[] = [
  { type: "boat", label: "Boat Cruise", icon: Ship },
  { type: "bike", label: "Bike Tour", icon: Bike },
  { type: "walk", label: "Walking Tour", icon: Footprints },
  { type: "food", label: "Food & Drinks Tour", icon: Utensils },
  { type: "other", label: "Other Experience", icon: Compass },
];

export default function CustomTourForm({ initialTour, onSave, onCancel }: CustomTourFormProps) {
  const [name, setName] = useState(initialTour?.name ?? "");
  const [tourType, setTourType] = useState<TourTransportType>(initialTour?.tourType ?? "boat");
  const [area, setArea] = useState(initialTour?.area ?? "");
  const [lat, setLat] = useState<number | "">(initialTour?.lat ?? 52.37);
  const [lng, setLng] = useState<number | "">(initialTour?.lng ?? 4.89);
  const [meta, setMeta] = useState(initialTour?.meta ?? "");
  const [note, setNote] = useState(initialTour?.note ?? "");
  const [bookingUrl, setBookingUrl] = useState(initialTour?.bookingUrl ?? "");
  const [photoUrl, setPhotoUrl] = useState(initialTour?.photos?.[0] ?? "");
  const [status, setStatus] = useState<"active" | "hidden">(initialTour?.status ?? "active");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Tour name is required.");
      return;
    }
    if (!bookingUrl.trim()) {
      setError("Booking URL is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: initialTour?.id,
        name: name.trim(),
        tourType,
        area: area.trim() || "Amsterdam",
        lat: typeof lat === "number" ? lat : 52.37,
        lng: typeof lng === "number" ? lng : 4.89,
        meta: meta.trim() || "Custom tour",
        note: note.trim(),
        bookingUrl: bookingUrl.trim(),
        photos: photoUrl.trim() ? [photoUrl.trim()] : [],
        status,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tour.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className={labelClass}>Tour Name *</label>
        <input
          type="text"
          required
          className={inputClass}
          placeholder="e.g. Hidden Canals Small-Group Cruise"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass}>Tour Type</label>
        <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TOUR_TYPES.map((item) => {
            const Icon = item.icon;
            const active = tourType === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => setTourType(item.type)}
                className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                  active
                    ? "border-[var(--studio-ink)] bg-[var(--studio-ink)] text-white shadow-sm"
                    : "border-[var(--studio-border)] bg-[var(--studio-surface)] text-[var(--studio-ink-soft)] hover:border-[var(--studio-ink-dim)] hover:text-[var(--studio-ink)]"
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Departure Area / Landmark</label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Anne Frank House Dock"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Meta & Price Tag</label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. 75 min · €29.50 pp · Drinks incl."
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Departure Latitude</label>
          <input
            type="number"
            step="any"
            className={inputClass}
            placeholder="52.3752"
            value={lat}
            onChange={(e) => setLat(parseFloat(e.target.value) || "")}
          />
        </div>
        <div>
          <label className={labelClass}>Departure Longitude</label>
          <input
            type="number"
            step="any"
            className={inputClass}
            placeholder="4.8840"
            value={lng}
            onChange={(e) => setLng(parseFloat(e.target.value) || "")}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Direct Booking URL *</label>
        <input
          type="url"
          required
          className={inputClass}
          placeholder="https://yourcompany.com/book/cruise"
          value={bookingUrl}
          onChange={(e) => setBookingUrl(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass}>Hero Photo URL</label>
        <input
          type="url"
          className={inputClass}
          placeholder="https://..."
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass}>Description / Highlights</label>
        <textarea
          rows={3}
          className={inputClass}
          placeholder="A personal introduction or highlight of what makes this tour special..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <GhostButton type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </GhostButton>
        <PrimaryButton type="submit" disabled={saving}>
          {saving ? "Saving..." : initialTour ? "Save Changes" : "Add Tour"}
        </PrimaryButton>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Bike, Footprints, Navigation, Plus, Ship, Trash2 } from "lucide-react";
import PortalToggle from "@/components/PortalToggle";
import type { Route, RouteStop, RouteTransportMode } from "@/lib/types";
import type { SaveRouteInput, SaveRouteStopInput } from "@/lib/data/types";
import { GhostButton, PrimaryButton, inputClass, labelClass } from "./primitives";

export interface RouteFormProps {
  initialRoute?: Route | null;
  onSave: (input: SaveRouteInput) => Promise<void>;
  onCancel: () => void;
}

const TRANSPORT_MODES: { mode: RouteTransportMode; label: string; icon: typeof Bike }[] = [
  { mode: "bike", label: "Cycling / Bike", icon: Bike },
  { mode: "walk", label: "Walking Tour", icon: Footprints },
  { mode: "boat", label: "Boat Cruise", icon: Ship },
  { mode: "drive", label: "Drive / Shuttle", icon: Navigation },
];

export default function RouteForm({ initialRoute, onSave, onCancel }: RouteFormProps) {
  const [title, setTitle] = useState(initialRoute?.title ?? "");
  const [transportMode, setTransportMode] = useState<RouteTransportMode>(initialRoute?.transportMode ?? "bike");
  const [summary, setSummary] = useState(initialRoute?.summary ?? "");
  const [description, setDescription] = useState(initialRoute?.description ?? "");
  const [durationMinutes, setDurationMinutes] = useState<number | "">(initialRoute?.durationMinutes ?? "");
  const [distanceMeters, setDistanceMeters] = useState<number | "">(initialRoute?.distanceMeters ?? "");
  const [photoUrl, setPhotoUrl] = useState(initialRoute?.photos?.[0] ?? "");
  const [isPublished, setIsPublished] = useState(initialRoute?.isPublished ?? true);

  const [stops, setStops] = useState<SaveRouteStopInput[]>(
    initialRoute?.stops?.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      address: s.address,
      lng: s.lng,
      lat: s.lat,
      stopOrder: s.stopOrder,
      photos: s.photos,
    })) ?? [
      { title: "", description: "", address: "", lng: 4.89, lat: 52.37, stopOrder: 1, photos: [] },
    ],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAddStop() {
    setStops((prev) => [
      ...prev,
      {
        title: "",
        description: "",
        address: "",
        lng: 4.89,
        lat: 52.37,
        stopOrder: prev.length + 1,
        photos: [],
      },
    ]);
  }

  function handleRemoveStop(index: number) {
    setStops((prev) => prev.filter((_, i) => i !== index));
  }

  function handleMoveStop(index: number, direction: "up" | "down") {
    setStops((prev) => {
      const copy = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= copy.length) return prev;
      const tmp = copy[index];
      copy[index] = copy[target];
      copy[target] = tmp;
      return copy.map((s, idx) => ({ ...s, stopOrder: idx + 1 }));
    });
  }

  function updateStop(index: number, field: keyof SaveRouteStopInput, val: any) {
    setStops((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const validStops = stops.filter((s) => s.title.trim().length > 0);
    if (validStops.length === 0) {
      setError("Please provide at least one route stop with a title.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: initialRoute?.id,
        title: title.trim(),
        transportMode,
        summary: summary.trim(),
        description: description.trim(),
        durationMinutes: durationMinutes === "" ? null : Number(durationMinutes),
        distanceMeters: distanceMeters === "" ? null : Number(distanceMeters),
        photos: photoUrl.trim() ? [photoUrl.trim()] : [],
        isPublished,
        stops: validStops.map((s, idx) => ({ ...s, stopOrder: idx + 1 })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save route.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Main info */}
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Route Title *</label>
          <input
            type="text"
            required
            className={inputClass}
            placeholder="e.g. Jordaan Historic Bike Loop"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Transport mode selector */}
        <div>
          <label className={labelClass}>Transport Mode</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TRANSPORT_MODES.map((item) => {
              const Icon = item.icon;
              const active = transportMode === item.mode;
              return (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => setTransportMode(item.mode)}
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

        <div>
          <label className={labelClass}>Short Summary</label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. A scenic 45-minute cycling loop through hidden Jordaan spots."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Detailed Description</label>
          <textarea
            rows={3}
            className={inputClass}
            placeholder="Describe the highlights, starting point details, and recommendations along the route..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Estimated Duration (minutes)</label>
            <input
              type="number"
              min={1}
              className={inputClass}
              placeholder="e.g. 45"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass}>Distance (meters)</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              placeholder="e.g. 5200 (5.2 km)"
              value={distanceMeters}
              onChange={(e) => setDistanceMeters(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
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

        <div className="flex items-center justify-between rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)] p-3.5">
          <div>
            <p className="text-xs font-semibold text-[var(--studio-ink)]">Published on Guest App</p>
            <p className="text-[11px] text-[var(--studio-ink-soft)]">When enabled, guests can view and navigate this route.</p>
          </div>
          <PortalToggle
            checked={isPublished}
            onChange={setIsPublished}
            label="Publish route"
          />
        </div>
      </div>

      {/* Waypoints / Stops */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold tracking-wider uppercase text-[var(--studio-ink-soft)]">
            Route Stops & Waypoints ({stops.length})
          </label>
          <button
            type="button"
            onClick={handleAddStop}
            className="flex items-center gap-1 text-xs font-semibold text-[var(--studio-ink)] hover:underline"
          >
            <Plus size={14} />
            <span>Add Stop</span>
          </button>
        </div>

        <div className="space-y-3">
          {stops.map((stop, idx) => (
            <div
              key={idx}
              className="relative rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-3.5 shadow-sm"
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--studio-ink)] text-[10px] font-bold text-white">
                  {idx + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveStop(idx, "up")}
                    className="rounded p-1 text-[var(--studio-ink-soft)] hover:bg-[var(--studio-bg)] disabled:opacity-30"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === stops.length - 1}
                    onClick={() => handleMoveStop(idx, "down")}
                    className="rounded p-1 text-[var(--studio-ink-soft)] hover:bg-[var(--studio-bg)] disabled:opacity-30"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={stops.length <= 1}
                    onClick={() => handleRemoveStop(idx)}
                    className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  required
                  className={inputClass}
                  placeholder="Stop name / landmark (e.g. Westerkerk & Anne Frank House)"
                  value={stop.title}
                  onChange={(e) => updateStop(idx, "title", e.target.value)}
                />
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Address or location details"
                  value={stop.address}
                  onChange={(e) => updateStop(idx, "address", e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    className={inputClass}
                    placeholder="Latitude (e.g. 52.3752)"
                    value={stop.lat || ""}
                    onChange={(e) => updateStop(idx, "lat", parseFloat(e.target.value) || 0)}
                  />
                  <input
                    type="number"
                    step="any"
                    className={inputClass}
                    placeholder="Longitude (e.g. 4.884)"
                    value={stop.lng || ""}
                    onChange={(e) => updateStop(idx, "lng", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Notes for guests at this stop (optional)"
                  value={stop.description}
                  onChange={(e) => updateStop(idx, "description", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <GhostButton type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </GhostButton>
        <PrimaryButton type="submit" disabled={saving}>
          {saving ? "Saving..." : initialRoute ? "Save Changes" : "Create Route"}
        </PrimaryButton>
      </div>
    </form>
  );
}

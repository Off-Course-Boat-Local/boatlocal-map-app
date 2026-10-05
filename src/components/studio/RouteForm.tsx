"use client";

import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bike,
  Footprints,
  Navigation,
  Plus,
  Ship,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import PortalToggle from "@/components/PortalToggle";
import type { Route, RouteStop, RouteTransportMode } from "@/lib/types";
import type { PlaceSearchResult } from "@/lib/admin/googlePlaces";
import RouteMapPicker from "./RouteMapPicker";
import StopPlaceSearch from "./StopPlaceSearch";
import type { SaveRouteInput, SaveRouteStopInput } from "@/lib/data/types";
import {
  GhostButton,
  PrimaryButton,
  inputClass,
  labelClass,
} from "./primitives";

export interface RouteFormProps {
  initialRoute?: Route | null;
  onSave: (input: SaveRouteInput) => Promise<void>;
  onCancel: () => void;
}

const TRANSPORT_MODES: {
  mode: RouteTransportMode;
  label: string;
  icon: typeof Bike;
}[] = [
  { mode: "bike", label: "Cycling / Bike", icon: Bike },
  { mode: "walk", label: "Walking Tour", icon: Footprints },
  { mode: "boat", label: "Boat Cruise", icon: Ship },
  { mode: "drive", label: "Drive / Shuttle", icon: Navigation },
];

export default function RouteForm({
  initialRoute,
  onSave,
  onCancel,
}: RouteFormProps) {
  const [title, setTitle] = useState(initialRoute?.title ?? "");
  const [transportMode, setTransportMode] = useState<RouteTransportMode>(
    initialRoute?.transportMode ?? "bike",
  );
  const [summary, setSummary] = useState(initialRoute?.summary ?? "");
  const [description, setDescription] = useState(
    initialRoute?.description ?? "",
  );
  const [durationMinutes, setDurationMinutes] = useState<number | "">(
    initialRoute?.durationMinutes ?? "",
  );
  const [distanceMeters, setDistanceMeters] = useState<number | "">(
    initialRoute?.distanceMeters ?? "",
  );
  const [photoUrl, setPhotoUrl] = useState(initialRoute?.photos?.[0] ?? "");
  const [isPublished, setIsPublished] = useState(
    initialRoute?.isPublished ?? true,
  );

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
      {
        title: "",
        description: "",
        address: "",
        lng: 4.89,
        lat: 52.37,
        stopOrder: 1,
        photos: [],
      },
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

  const DEFAULT_LAT = 52.37;
  const DEFAULT_LNG = 4.89;
  function isPlaced(stop: SaveRouteStopInput) {
    return (
      stop.title.trim() !== "" ||
      (stop.address ?? "").trim() !== "" ||
      stop.lat !== DEFAULT_LAT ||
      stop.lng !== DEFAULT_LNG
    );
  }

  // Map click: fill the first blank stop, otherwise append a new one, then
  // try to name it from the clicked point (best-effort — pin stays regardless).
  function handleMapAdd(point: { lat: number; lng: number }) {
    let targetIndex = stops.findIndex((s) => !isPlaced(s));
    if (targetIndex === -1) targetIndex = stops.length;
    setStops((prev) => {
      const blank = prev.findIndex((s) => !isPlaced(s));
      if (blank !== -1) {
        const copy = [...prev];
        copy[blank] = { ...copy[blank], lat: point.lat, lng: point.lng };
        return copy;
      }
      return [
        ...prev,
        {
          title: "",
          description: "",
          address: "",
          lat: point.lat,
          lng: point.lng,
          stopOrder: prev.length + 1,
          photos: [],
        },
      ];
    });
    void fillFromPoint(targetIndex, point);
  }

  function handleMapMove(index: number, point: { lat: number; lng: number }) {
    updateStopPosition(index, point);
    void fillFromPoint(index, point);
  }

  function updateStopPosition(
    index: number,
    point: { lat: number; lng: number },
  ) {
    setStops((prev) => {
      const copy = [...prev];
      if (!copy[index]) return prev;
      copy[index] = { ...copy[index], lat: point.lat, lng: point.lng };
      return copy;
    });
  }

  // Only fills name/address that are still empty — never overwrites typed text.
  async function fillFromPoint(
    index: number,
    point: { lat: number; lng: number },
  ) {
    try {
      const res = await fetch(
        `/api/studio/geocode/reverse?lat=${point.lat}&lng=${point.lng}`,
      );
      const json = (await res.json()) as {
        result?: { label: string; address: string } | null;
      };
      const found = json.result;
      if (!found) return;
      setStops((prev) => {
        const current = prev[index];
        if (!current) return prev;
        const copy = [...prev];
        copy[index] = {
          ...current,
          title: current.title.trim() ? current.title : found.label,
          address: (current.address ?? "").trim()
            ? current.address
            : found.address,
        };
        return copy;
      });
    } catch {
      // Name/address stay blank to type — the pin is already placed.
    }
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

  function updateStop(
    index: number,
    field: keyof SaveRouteStopInput,
    val: any,
  ) {
    setStops((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  }

  const [uploading, setUploading] = useState(false);
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setPhotoNotice(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoNotice("Use a PNG, JPG or WEBP image.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setPhotoNotice("That image is over 4MB — pick a smaller one.");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/recommendations/photos/upload", {
        method: "POST",
        body,
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed.");
      setPhotoUrl(json.url);
    } catch (err) {
      setPhotoNotice(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Picking a Google Maps result fills the stop; if there's no hero photo yet,
  // also pull one image (photos=1 — a single download, not the usual 8).
  async function handlePickPlace(index: number, place: PlaceSearchResult) {
    setStops((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        title: place.name,
        address: place.address,
        lat: place.lat ?? copy[index].lat,
        lng: place.lng ?? copy[index].lng,
      };
      return copy;
    });
    if (photoUrl.trim()) return;
    setUploading(true);
    try {
      const res = await fetch(
        `/api/studio/places/details?placeId=${encodeURIComponent(place.placeId)}&photos=1`,
      );
      const json = (await res.json()) as { details?: { photos?: string[] } };
      const first = json.details?.photos?.[0];
      if (first) setPhotoUrl((cur) => cur || first);
    } catch {
      // Photo is a nicety — the stop itself is already filled in.
    } finally {
      setUploading(false);
    }
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
        durationMinutes:
          durationMinutes === "" ? null : Number(durationMinutes),
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
            {TRANSPORT_MODES.filter(
              // Boat Cruise is hidden for new routes; kept when editing an existing boat route.
              (item) =>
                item.mode !== "boat" || initialRoute?.transportMode === "boat",
            ).map((item) => {
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
              onChange={(e) =>
                setDurationMinutes(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
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
              onChange={(e) =>
                setDistanceMeters(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Hero Photo</label>
          {photoUrl.trim() ? (
            <div className="relative mt-1.5 w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="Hero preview"
                className="h-28 w-44 rounded-xl border border-[var(--studio-border)] object-cover"
              />
              <button
                type="button"
                onClick={() => setPhotoUrl("")}
                aria-label="Remove photo"
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-slate-900 text-white shadow-xs"
              >
                <X className="size-3" strokeWidth={2.5} />
              </button>
            </div>
          ) : null}
          <div className="mt-1.5 flex items-center gap-3">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--studio-accent)] px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="size-3.5" strokeWidth={2.25} />
              {uploading
                ? "Working…"
                : photoUrl.trim()
                  ? "Replace Photo"
                  : "Upload Photo"}
            </button>
            <span className="text-xs text-[var(--studio-ink-soft)]">
              PNG, JPG, WEBP up to 4MB — or pick a stop via Google Maps below
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void handleFile(e.target.files?.[0])}
            className="sr-only"
          />
          <input
            type="url"
            className={`${inputClass} mt-2`}
            placeholder="…or paste an image URL"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
          />
          {photoNotice ? (
            <p role="alert" className="mt-1.5 text-xs text-red-600">
              {photoNotice}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)] p-3.5">
          <div>
            <p className="text-xs font-semibold text-[var(--studio-ink)]">
              Published on Guest App
            </p>
            <p className="text-[11px] text-[var(--studio-ink-soft)]">
              When enabled, guests can view and navigate this route.
            </p>
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

        <RouteMapPicker
          stops={stops.map((s) => ({
            lat: s.lat,
            lng: s.lng,
            placed: isPlaced(s),
          }))}
          onAdd={handleMapAdd}
          onMove={handleMapMove}
        />

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
                <StopPlaceSearch
                  auto
                  query={stop.title}
                  onPick={(place) => void handlePickPlace(idx, place)}
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
                    onChange={(e) =>
                      updateStop(idx, "lat", parseFloat(e.target.value) || 0)
                    }
                  />
                  <input
                    type="number"
                    step="any"
                    className={inputClass}
                    placeholder="Longitude (e.g. 4.884)"
                    value={stop.lng || ""}
                    onChange={(e) =>
                      updateStop(idx, "lng", parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Notes for guests at this stop (optional)"
                  value={stop.description}
                  onChange={(e) =>
                    updateStop(idx, "description", e.target.value)
                  }
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
          {saving
            ? "Saving..."
            : initialRoute
              ? "Save Changes"
              : "Create Route"}
        </PrimaryButton>
      </div>
    </form>
  );
}

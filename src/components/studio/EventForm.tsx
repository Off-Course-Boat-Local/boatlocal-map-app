"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import PortalToggle from "@/components/PortalToggle";
import StopPlaceSearch from "./StopPlaceSearch";
import type { PlaceSearchResult } from "@/lib/admin/googlePlaces";
import type { CompanyEvent } from "@/lib/types";
import type { SaveCompanyEventInput } from "@/lib/data/types";
import { GhostButton, PrimaryButton, inputClass, labelClass } from "./primitives";

export interface EventFormProps {
  initialEvent?: CompanyEvent | null;
  onSave: (input: SaveCompanyEventInput) => Promise<void>;
  onCancel: () => void;
}

function toLocalDatetimeInput(isoStr?: string | null): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export default function EventForm({ initialEvent, onSave, onCancel }: EventFormProps) {
  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const [startTime, setStartTime] = useState(toLocalDatetimeInput(initialEvent?.startTime) || toLocalDatetimeInput(new Date().toISOString()));
  const [endTime, setEndTime] = useState(toLocalDatetimeInput(initialEvent?.endTime));
  const [venueName, setVenueName] = useState(initialEvent?.venueName ?? "");
  const [address, setAddress] = useState(initialEvent?.address ?? "");
  const [lat, setLat] = useState<number | "">(initialEvent?.lat ?? 52.37);
  const [lng, setLng] = useState<number | "">(initialEvent?.lng ?? 4.89);
  const [photoUrl, setPhotoUrl] = useState(initialEvent?.photos?.[0] ?? "");
  const [ticketUrl, setTicketUrl] = useState(initialEvent?.ticketUrl ?? "");
  const [priceLabel, setPriceLabel] = useState(initialEvent?.priceLabel ?? "");
  const [isPublished, setIsPublished] = useState(initialEvent?.isPublished ?? true);

  const [saving, setSaving] = useState(false);
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
      const res = await fetch("/api/recommendations/photos/upload", { method: "POST", body });
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

  // Picking a Google Maps result fills venue/address/coords; if there's no
  // hero photo yet, also pull one image (photos=1 — one download, not 8).
  async function handlePickPlace(place: PlaceSearchResult) {
    setVenueName(place.name);
    setAddress(place.address);
    if (place.lat !== null) setLat(place.lat);
    if (place.lng !== null) setLng(place.lng);
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
      // Photo is a nicety — venue fields are already filled in.
    } finally {
      setUploading(false);
    }
  }
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Event title is required.");
      return;
    }
    if (!startTime) {
      setError("Start date and time are required.");
      return;
    }
    if (!address.trim()) {
      setError("Address is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: initialEvent?.id,
        title: title.trim(),
        description: description.trim(),
        startTime: new Date(startTime).toISOString(),
        endTime: endTime ? new Date(endTime).toISOString() : null,
        venueName: venueName.trim() || null,
        address: address.trim(),
        lat: typeof lat === "number" ? lat : 52.37,
        lng: typeof lng === "number" ? lng : 4.89,
        photos: photoUrl.trim() ? [photoUrl.trim()] : [],
        ticketUrl: ticketUrl.trim() || null,
        priceLabel: priceLabel.trim() || null,
        isPublished,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event.");
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
        <label className={labelClass}>Event Title *</label>
        <input
          type="text"
          required
          className={inputClass}
          placeholder="e.g. Friday Canal Sunset Social"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Start Date & Time *</label>
          <input
            type="datetime-local"
            required
            className={inputClass}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>End Date & Time (optional)</label>
          <input
            type="datetime-local"
            className={inputClass}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Venue / Meeting Spot Name</label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Prinsengracht Canal Dock"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
          />
          <div className="mt-1.5">
            <StopPlaceSearch query={venueName || title} onPick={(p) => void handlePickPlace(p)} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Price / Admission Label</label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Free RSVP or €15 pp"
            value={priceLabel}
            onChange={(e) => setPriceLabel(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Address *</label>
        <input
          type="text"
          required
          className={inputClass}
          placeholder="e.g. Prinsengracht 2, Amsterdam"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Latitude</label>
          <input
            type="number"
            step="any"
            className={inputClass}
            placeholder="52.3799"
            value={lat}
            onChange={(e) => setLat(parseFloat(e.target.value) || "")}
          />
        </div>
        <div>
          <label className={labelClass}>Longitude</label>
          <input
            type="number"
            step="any"
            className={inputClass}
            placeholder="4.8846"
            value={lng}
            onChange={(e) => setLng(parseFloat(e.target.value) || "")}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Ticket / Booking / RSVP URL</label>
        <input
          type="url"
          className={inputClass}
          placeholder="https://..."
          value={ticketUrl}
          onChange={(e) => setTicketUrl(e.target.value)}
        />
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
            {uploading ? "Working…" : photoUrl.trim() ? "Replace Photo" : "Upload Photo"}
          </button>
          <span className="text-xs text-[var(--studio-ink-soft)]">
            PNG, JPG, WEBP up to 4MB — or pick the venue via Google Maps above
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

      <div>
        <label className={labelClass}>Event Description</label>
        <textarea
          rows={3}
          className={inputClass}
          placeholder="Describe the event, special activities, what to bring..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)] p-3.5">
        <div>
          <p className="text-xs font-semibold text-[var(--studio-ink)]">Published on Guest App</p>
          <p className="text-[11px] text-[var(--studio-ink-soft)]">When enabled, guests will see this event highlighted on their map.</p>
        </div>
        <PortalToggle
          checked={isPublished}
          onChange={setIsPublished}
          label="Publish event"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <GhostButton type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </GhostButton>
        <PrimaryButton type="submit" disabled={saving || uploading}>
          {saving ? "Saving..." : initialEvent ? "Save Changes" : "Create Event"}
        </PrimaryButton>
      </div>
    </form>
  );
}

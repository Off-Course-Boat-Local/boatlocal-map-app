"use client";

import { useState } from "react";
import PortalToggle from "@/components/PortalToggle";
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
        <PrimaryButton type="submit" disabled={saving}>
          {saving ? "Saving..." : initialEvent ? "Save Changes" : "Create Event"}
        </PrimaryButton>
      </div>
    </form>
  );
}

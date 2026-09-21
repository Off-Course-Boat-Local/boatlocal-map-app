"use client";

import { useState } from "react";
import { Calendar, CalendarDays, ExternalLink, MapPin, Plus, Trash2 } from "lucide-react";
import PortalModal from "@/components/PortalModal";
import PortalToggle from "@/components/PortalToggle";
import type { CompanyEvent } from "@/lib/types";
import type { SaveCompanyEventInput } from "@/lib/data/types";
import { deleteCompanyEventAction, saveCompanyEventAction } from "@/lib/studio/eventActions";
import { CARD_SHADOW, GhostButton, PageHeader, PrimaryButton } from "./primitives";
import EventForm from "./EventForm";

export interface EventsManagerProps {
  initialEvents: CompanyEvent[];
}

function formatEventDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

export default function EventsManager({ initialEvents }: EventsManagerProps) {
  const [events, setEvents] = useState<CompanyEvent[]>(initialEvents);
  const [editingEvent, setEditingEvent] = useState<CompanyEvent | null | "new">(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(input: SaveCompanyEventInput) {
    const res = await saveCompanyEventAction(input);
    if (res.error) throw new Error(res.error);
    if (res.event) {
      const saved = res.event;
      setEvents((prev) => {
        const existingIdx = prev.findIndex((e) => e.id === saved.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = saved;
          return updated;
        }
        return [...prev, saved];
      });
      setEditingEvent(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this event?")) return;
    setDeletingId(id);
    const res = await deleteCompanyEventAction(id);
    if (res.error) {
      setError(res.error);
    } else {
      setEvents((prev) => prev.filter((e) => e.id !== id));
    }
    setDeletingId(null);
  }

  async function handleTogglePublished(event: CompanyEvent, isPublished: boolean) {
    setEvents((prev) =>
      prev.map((e) => (e.id === event.id ? { ...e, isPublished } : e)),
    );
    const res = await saveCompanyEventAction({
      id: event.id,
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      venueName: event.venueName,
      address: event.address,
      lng: event.lng,
      lat: event.lat,
      photos: event.photos,
      ticketUrl: event.ticketUrl,
      priceLabel: event.priceLabel,
      isPublished,
    });
    if (res.error) {
      setError(res.error);
      setEvents(events); // rollback
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Events & Meetups"
          description="Publish company events, gatherings, and promotions with Google Maps locations and RSVP/ticket links."
        />
        <PrimaryButton onClick={() => setEditingEvent("new")}>
          <Plus size={16} className="mr-1.5 inline" />
          Create Event
        </PrimaryButton>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--studio-border)] p-12 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-[var(--studio-ink-soft)] opacity-40" />
          <h3 className="mt-3 text-sm font-semibold text-[var(--studio-ink)]">No events scheduled</h3>
          <p className="mt-1 text-xs text-[var(--studio-ink-soft)]">
            Create an event or meetup for your guests to discover.
          </p>
          <div className="mt-4">
            <PrimaryButton onClick={() => setEditingEvent("new")}>
              <Plus size={16} className="mr-1.5 inline" />
              Create Event
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {events.map((event) => (
            <div
              key={event.id}
              className={`flex flex-col justify-between rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 transition-shadow hover:shadow-md ${CARD_SHADOW}`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                    <Calendar size={13} />
                    {formatEventDate(event.startTime)}
                  </div>
                  <PortalToggle
                    checked={event.isPublished}
                    onChange={(checked) => handleTogglePublished(event, checked)}
                    label={`Publish ${event.title}`}
                  />
                </div>

                <h3 className="mt-3 text-base font-bold text-[var(--studio-ink)]">{event.title}</h3>
                {event.description && (
                  <p className="mt-1 text-xs text-[var(--studio-ink-soft)] line-clamp-2">{event.description}</p>
                )}

                <div className="mt-4 space-y-1 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)] p-3 text-xs">
                  {event.venueName && (
                    <p className="font-semibold text-[var(--studio-ink)]">{event.venueName}</p>
                  )}
                  <p className="flex items-center gap-1.5 text-[var(--studio-ink-soft)]">
                    <MapPin size={13} className="shrink-0" />
                    <span className="truncate">{event.address}</span>
                  </p>
                  {event.priceLabel && (
                    <p className="pt-1 font-semibold text-emerald-600">{event.priceLabel}</p>
                  )}
                  {event.ticketUrl && (
                    <a
                      href={event.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 pt-1 text-[11px] font-medium text-[var(--studio-ink)] hover:underline"
                    >
                      <span>Booking / RSVP Link</span>
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-[var(--studio-border)] pt-3.5">
                <GhostButton
                  size="sm"
                  disabled={deletingId === event.id}
                  onClick={() => handleDelete(event.id)}
                  className="text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} className="mr-1 inline" />
                  Delete
                </GhostButton>
                <GhostButton size="sm" onClick={() => setEditingEvent(event)}>
                  Edit Event
                </GhostButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {editingEvent && (
        <PortalModal
          open={true}
          onClose={() => setEditingEvent(null)}
          title={editingEvent === "new" ? "Create Event" : "Edit Event"}
        >
          <EventForm
            initialEvent={editingEvent === "new" ? null : editingEvent}
            onSave={handleSave}
            onCancel={() => setEditingEvent(null)}
          />
        </PortalModal>
      )}
    </div>
  );
}

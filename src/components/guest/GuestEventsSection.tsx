"use client";

import { useState } from "react";
import { Calendar, ExternalLink, MapPin, X } from "lucide-react";
import type { CompanyEvent } from "@/lib/types";
import { CARD_SHADOW } from "@/components/studio/primitives";

export interface GuestEventsSectionProps {
  events: CompanyEvent[];
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

export function GuestEventsSection({ events }: GuestEventsSectionProps) {
  const [activeEvent, setActiveEvent] = useState<CompanyEvent | null>(null);

  if (!events || events.length === 0) return null;

  return (
    <div className="space-y-3 px-4 py-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#657386]">
          Upcoming Events & Specials
        </h2>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {events.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => setActiveEvent(event)}
            className="flex w-64 shrink-0 flex-col justify-between rounded-2xl border border-[#E1E7EE] bg-white p-3.5 text-left shadow-sm transition-transform active:scale-[0.98]"
          >
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700">
                <Calendar size={11} />
                <span>{formatEventDate(event.startTime)}</span>
              </div>
              <h3 className="mt-2 text-sm font-bold text-[#0B1421] line-clamp-1">{event.title}</h3>
              {event.venueName && (
                <p className="mt-0.5 text-xs text-[#657386] truncate">{event.venueName}</p>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[#F1F3F6] pt-2 text-xs">
              <span className="font-semibold text-emerald-600">{event.priceLabel || "RSVP"}</span>
              <span className="text-[11px] font-medium text-[#1A62D6]">View details →</span>
            </div>
          </button>
        ))}
      </div>

      {/* Event Detail Drawer / Modal */}
      {activeEvent && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setActiveEvent(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                <Calendar size={12} />
                <span>{formatEventDate(activeEvent.startTime)}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveEvent(null)}
                className="grid size-8 place-items-center rounded-full bg-[#F1F3F6] text-[#657386]"
              >
                <X size={16} />
              </button>
            </div>

            <h2 className="mt-3 text-lg font-bold text-[#0B1421]">{activeEvent.title}</h2>
            {activeEvent.description && (
              <p className="mt-2 text-xs leading-relaxed text-[#657386]">{activeEvent.description}</p>
            )}

            <div className="mt-4 space-y-2 rounded-2xl bg-[#F8FAFC] p-3.5 text-xs text-[#0B1421]">
              {activeEvent.venueName && (
                <p className="font-bold">{activeEvent.venueName}</p>
              )}
              <p className="flex items-center gap-1.5 text-[#657386]">
                <MapPin size={13} className="shrink-0" />
                <span>{activeEvent.address}</span>
              </p>
              {activeEvent.priceLabel && (
                <p className="font-semibold text-emerald-600">{activeEvent.priceLabel}</p>
              )}
            </div>

            {activeEvent.ticketUrl && (
              <a
                href={activeEvent.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B1421] py-3.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                <span>RSVP / Get Tickets</span>
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

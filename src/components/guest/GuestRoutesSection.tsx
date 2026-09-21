"use client";

import { useState } from "react";
import { Bike, Clock, Footprints, MapPin, Navigation, Ship, X, ChevronRight } from "lucide-react";
import type { Route, RouteStop, RouteTransportMode } from "@/lib/types";

export interface GuestRoutesSectionProps {
  routes: Route[];
  onSelectStop?: (stop: RouteStop) => void;
}

const MODE_META: Record<RouteTransportMode, { label: string; icon: typeof Bike; badgeClass: string }> = {
  bike: { label: "Cycling Route", icon: Bike, badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  walk: { label: "Walking Route", icon: Footprints, badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  boat: { label: "Boat Cruise", icon: Ship, badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  drive: { label: "Drive / Shuttle", icon: Navigation, badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
};

export function GuestRoutesSection({ routes, onSelectStop }: GuestRoutesSectionProps) {
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);

  if (!routes || routes.length === 0) return null;

  return (
    <div className="space-y-3 px-4 py-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#657386]">
          Curated Routes & Itineraries
        </h2>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {routes.map((route) => {
          const modeInfo = MODE_META[route.transportMode] ?? MODE_META.bike;
          const ModeIcon = modeInfo.icon;

          return (
            <button
              key={route.id}
              type="button"
              onClick={() => setActiveRoute(route)}
              className="flex w-72 shrink-0 flex-col justify-between rounded-2xl border border-[#E1E7EE] bg-white p-3.5 text-left shadow-sm transition-transform active:scale-[0.98]"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${modeInfo.badgeClass}`}>
                    <ModeIcon size={11} />
                    {modeInfo.label}
                  </span>
                  {route.durationMinutes && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#657386]">
                      <Clock size={10} />
                      {route.durationMinutes}m
                    </span>
                  )}
                  {route.distanceMeters && (
                    <span className="text-[11px] text-[#657386]">
                      · {(route.distanceMeters / 1000).toFixed(1)}km
                    </span>
                  )}
                </div>
                <h3 className="mt-2 text-sm font-bold text-[#0B1421] line-clamp-1">{route.title}</h3>
                {route.summary && (
                  <p className="mt-1 text-xs text-[#657386] line-clamp-2">{route.summary}</p>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#F1F3F6] pt-2 text-xs">
                <span className="text-[11px] font-medium text-[#657386]">
                  {route.stops?.length ?? 0} stops
                </span>
                <span className="text-[11px] font-semibold text-[#1A62D6]">
                  View Itinerary →
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Route Detail Sheet */}
      {activeRoute && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setActiveRoute(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#F1F3F6] p-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    {MODE_META[activeRoute.transportMode]?.label ?? "Route"}
                  </span>
                  {activeRoute.durationMinutes && (
                    <span className="text-xs text-[#657386]">{activeRoute.durationMinutes} minutes</span>
                  )}
                </div>
                <h2 className="mt-1.5 text-base font-bold text-[#0B1421]">{activeRoute.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveRoute(null)}
                className="grid size-8 place-items-center rounded-full bg-[#F1F3F6] text-[#657386]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4">
              {activeRoute.description && (
                <p className="text-xs leading-relaxed text-[#657386]">{activeRoute.description}</p>
              )}

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#657386]">
                  Stops & Waypoints ({activeRoute.stops?.length ?? 0})
                </h4>
                <div className="mt-3 space-y-3">
                  {activeRoute.stops?.map((stop, idx) => (
                    <div
                      key={stop.id || idx}
                      className="flex gap-3 rounded-2xl border border-[#E1E7EE] bg-[#F8FAFC] p-3.5 transition-colors hover:bg-white"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0B1421] text-xs font-bold text-white">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-xs text-[#0B1421]">{stop.title}</p>
                        {stop.address && (
                          <p className="flex items-center gap-1 text-[11px] text-[#657386]">
                            <MapPin size={11} className="shrink-0" />
                            <span className="truncate">{stop.address}</span>
                          </p>
                        )}
                        {stop.description && (
                          <p className="mt-1 text-xs text-[#657386]">{stop.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

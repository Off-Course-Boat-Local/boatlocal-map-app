"use client";

import { useState } from "react";
import { Bike, Clock, Footprints, MapPin, Navigation, Navigation2, Plus, Ship, Trash2 } from "lucide-react";
import PortalModal from "@/components/PortalModal";
import PortalToggle from "@/components/PortalToggle";
import type { Route, RouteTransportMode } from "@/lib/types";
import type { SaveRouteInput } from "@/lib/data/types";
import { deleteRouteAction, saveRouteAction } from "@/lib/studio/routeActions";
import { CARD_SHADOW, GhostButton, PageHeader, PrimaryButton } from "./primitives";
import RouteForm from "./RouteForm";

export interface RoutesManagerProps {
  initialRoutes: Route[];
}

const MODE_META: Record<RouteTransportMode, { label: string; icon: typeof Bike; badgeClass: string }> = {
  bike: { label: "Cycling", icon: Bike, badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  walk: { label: "Walking", icon: Footprints, badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  boat: { label: "Boat Cruise", icon: Ship, badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  drive: { label: "Drive / Shuttle", icon: Navigation, badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
};

export default function RoutesManager({ initialRoutes }: RoutesManagerProps) {
  const [routes, setRoutes] = useState<Route[]>(initialRoutes);
  const [editingRoute, setEditingRoute] = useState<Route | null | "new">(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(input: SaveRouteInput) {
    const res = await saveRouteAction(input);
    if (res.error) throw new Error(res.error);
    if (res.route) {
      const saved = res.route;
      setRoutes((prev) => {
        const existingIdx = prev.findIndex((r) => r.id === saved.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = saved;
          return updated;
        }
        return [...prev, saved];
      });
      setEditingRoute(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this route?")) return;
    setDeletingId(id);
    const res = await deleteRouteAction(id);
    if (res.error) {
      setError(res.error);
    } else {
      setRoutes((prev) => prev.filter((r) => r.id !== id));
    }
    setDeletingId(null);
  }

  async function handleTogglePublished(route: Route, isPublished: boolean) {
    setRoutes((prev) =>
      prev.map((r) => (r.id === route.id ? { ...r, isPublished } : r)),
    );
    const res = await saveRouteAction({
      id: route.id,
      title: route.title,
      transportMode: route.transportMode,
      summary: route.summary,
      description: route.description,
      durationMinutes: route.durationMinutes,
      distanceMeters: route.distanceMeters,
      photos: route.photos,
      isPublished,
      stops: route.stops,
    });
    if (res.error) {
      setError(res.error);
      setRoutes(routes); // rollback
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Routes & Itineraries"
          description="Create custom bike, walking, or boating routes with stops and turn-by-turn guidance for your guests."
        />
        <PrimaryButton onClick={() => setEditingRoute("new")}>
          <Plus size={16} className="mr-1.5 inline" />
          Create Route
        </PrimaryButton>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {routes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--studio-border)] p-12 text-center">
          <Navigation2 className="mx-auto h-10 w-10 text-[var(--studio-ink-soft)] opacity-40" />
          <h3 className="mt-3 text-sm font-semibold text-[var(--studio-ink)]">No routes created yet</h3>
          <p className="mt-1 text-xs text-[var(--studio-ink-soft)]">
            Create your first custom cycling or walking itinerary for your guests.
          </p>
          <div className="mt-4">
            <PrimaryButton onClick={() => setEditingRoute("new")}>
              <Plus size={16} className="mr-1.5 inline" />
              Create Route
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {routes.map((route) => {
            const modeInfo = MODE_META[route.transportMode] ?? MODE_META.bike;
            const ModeIcon = modeInfo.icon;

            return (
              <div
                key={route.id}
                className={`flex flex-col justify-between rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 transition-shadow hover:shadow-md ${CARD_SHADOW}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${modeInfo.badgeClass}`}
                      >
                        <ModeIcon size={13} />
                        {modeInfo.label}
                      </span>
                      {route.durationMinutes && (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--studio-ink-soft)]">
                          <Clock size={12} />
                          {route.durationMinutes} min
                        </span>
                      )}
                      {route.distanceMeters && (
                        <span className="text-xs text-[var(--studio-ink-soft)]">
                          · {(route.distanceMeters / 1000).toFixed(1)} km
                        </span>
                      )}
                    </div>
                    <PortalToggle
                      checked={route.isPublished}
                      onChange={(checked) => handleTogglePublished(route, checked)}
                      label={`Publish ${route.title}`}
                    />
                  </div>

                  <h3 className="mt-3 text-base font-bold text-[var(--studio-ink)]">{route.title}</h3>
                  {route.summary && (
                    <p className="mt-1 text-xs text-[var(--studio-ink-soft)] line-clamp-2">{route.summary}</p>
                  )}

                  {/* Stops preview */}
                  <div className="mt-4 space-y-1.5 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)] p-3 text-xs">
                    <p className="font-semibold text-[var(--studio-ink)]">
                      {route.stops?.length ?? 0} {route.stops?.length === 1 ? "Stop" : "Stops"}:
                    </p>
                    <ol className="list-inside list-decimal space-y-1 text-[var(--studio-ink-soft)]">
                      {route.stops?.slice(0, 4).map((stop, idx) => (
                        <li key={idx} className="truncate">
                          <span className="font-medium text-[var(--studio-ink)]">{stop.title}</span>
                          {stop.address ? ` — ${stop.address}` : ""}
                        </li>
                      ))}
                      {(route.stops?.length ?? 0) > 4 && (
                        <li className="text-[11px] italic text-[var(--studio-ink-dim)]">
                          +{route.stops.length - 4} more stops
                        </li>
                      )}
                    </ol>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2 border-t border-[var(--studio-border)] pt-3.5">
                  <GhostButton
                    size="sm"
                    disabled={deletingId === route.id}
                    onClick={() => handleDelete(route.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} className="mr-1 inline" />
                    Delete
                  </GhostButton>
                  <GhostButton size="sm" onClick={() => setEditingRoute(route)}>
                    Edit Route
                  </GhostButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {editingRoute && (
        <PortalModal
          open={true}
          onClose={() => setEditingRoute(null)}
          title={editingRoute === "new" ? "Create Route" : "Edit Route"}
        >
          <RouteForm
            initialRoute={editingRoute === "new" ? null : editingRoute}
            onSave={handleSave}
            onCancel={() => setEditingRoute(null)}
          />
        </PortalModal>
      )}
    </div>
  );
}

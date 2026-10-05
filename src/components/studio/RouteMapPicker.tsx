"use client";

// Visual stop picker for the route form: click the map to drop a stop, drag
// a pin to adjust it. Numbered pins match the stop cards below, joined by a
// line in order. Google map (BaseMap) for the same reason AddressField uses
// one — what a company positions against is what guests see.

import { useEffect, useRef } from "react";

import BaseMap, { useMapInstance } from "@/components/map/BaseMap";
import { PORTAL_ACCENT } from "@/components/MapAppMark";

export interface PickerStop {
  lat: number;
  lng: number;
  /** False for a blank stop still sitting at the default coordinate — no pin drawn. */
  placed: boolean;
}

export interface RouteMapPickerProps {
  stops: PickerStop[];
  onAdd: (point: { lat: number; lng: number }) => void;
  onMove: (index: number, point: { lat: number; lng: number }) => void;
}

const AMSTERDAM = { lat: 52.3731, lng: 4.8922 };

function Layer({ stops, onAdd, onMove }: RouteMapPickerProps) {
  const map = useMapInstance();
  const markersRef = useRef<google.maps.Marker[]>([]);
  const lineRef = useRef<google.maps.Polyline | null>(null);
  // Set by our own click/drag so the camera doesn't jump under the cursor;
  // changes that come from elsewhere (a search pick) do refit.
  const skipFitRef = useRef(false);
  const onAddRef = useRef(onAdd);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onAddRef.current = onAdd;
    onMoveRef.current = onMove;
  });

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener(
      "click",
      (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        skipFitRef.current = true;
        onAddRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      },
    );
    return () => listener.remove();
  }, [map]);

  const key = stops
    .map((s) => (s.placed ? `${s.lat.toFixed(6)},${s.lng.toFixed(6)}` : "-"))
    .join("|");

  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    void (async () => {
      const { importLibrary } = await import("@googlemaps/js-api-loader");
      await importLibrary("marker");
      if (cancelled) return;

      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      const path: google.maps.LatLngLiteral[] = [];
      stops.forEach((s, i) => {
        if (!s.placed) return;
        const position = { lat: s.lat, lng: s.lng };
        path.push(position);
        const marker = new google.maps.Marker({
          position,
          map,
          draggable: true,
          cursor: "grab",
          label: {
            text: String(i + 1),
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: "700",
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: PORTAL_ACCENT,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
        marker.addListener("dragend", () => {
          const next = marker.getPosition();
          if (!next) return;
          skipFitRef.current = true;
          onMoveRef.current(i, { lat: next.lat(), lng: next.lng() });
        });
        markersRef.current.push(marker);
      });

      lineRef.current?.setMap(null);
      lineRef.current =
        path.length > 1
          ? new google.maps.Polyline({
              path,
              map,
              strokeColor: PORTAL_ACCENT,
              strokeOpacity: 0.85,
              strokeWeight: 4,
              clickable: false,
            })
          : null;

      if (skipFitRef.current) {
        skipFitRef.current = false;
        return;
      }
      if (path.length === 1) {
        map.panTo(path[0]);
        if ((map.getZoom() ?? 0) < 14) map.setZoom(15);
      } else if (path.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        path.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, 48);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `key` captures every position that matters; `stops` identity changes on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  useEffect(
    () => () => {
      markersRef.current.forEach((m) => m.setMap(null));
      lineRef.current?.setMap(null);
    },
    [],
  );

  return null;
}

export default function RouteMapPicker(props: RouteMapPickerProps) {
  const first = props.stops.find((s) => s.placed);
  return (
    <div className="space-y-1.5">
      <div className="overflow-hidden rounded-xl border border-[var(--studio-border)]">
        <BaseMap
          center={first ? { lat: first.lat, lng: first.lng } : AMSTERDAM}
          zoom={first ? 15 : 12}
          className="h-64 w-full"
          minZoom={8}
          maxZoom={19}
        >
          <Layer {...props} />
        </BaseMap>
      </div>
      <p className="text-xs text-[var(--studio-ink-soft)]">
        Click the map to add a stop · drag a pin to fine-tune it
      </p>
    </div>
  );
}

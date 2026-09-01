// Shared google.maps.OverlayView helper — the Google Maps equivalent of
// MapLibre's `new Marker({ element })`: React owns the pixels of an
// arbitrary DOM node (portaled in by the caller), Google Maps owns tracking
// it through pan/zoom. Used by both MapPins (Pin) and GuestDot, same as
// they both used maplibregl.Marker before the Google Maps switch (see
// BaseMap.tsx's header comment).
//
// Deliberately OverlayView, not the newer google.maps.marker.AdvancedMarkerElement
// — Advanced Markers require a cloud-configured Map ID (or the explicitly
// non-production 'DEMO_MAP_ID'), which this app doesn't have. OverlayView
// needs neither a Map ID nor cloud-based styling.

export interface DomOverlayHandle {
  /** Portal React content into this — an empty div, same contract Pin/GuestDot's callers already expect. */
  element: HTMLDivElement;
  setPosition: (position: { lng: number; lat: number }) => void;
  remove: () => void;
}

/** Where the coordinate sits on the element: "bottom" for a teardrop pin (tip = coordinate), "center" for a plain dot. */
export type DomOverlayAnchor = "bottom" | "center";

export function createDomOverlay(
  map: google.maps.Map,
  position: { lng: number; lat: number },
  anchor: DomOverlayAnchor,
): DomOverlayHandle {
  class Overlay extends google.maps.OverlayView {
    readonly element: HTMLDivElement;
    private latLng: google.maps.LatLng;

    constructor(latLng: google.maps.LatLng) {
      super();
      this.latLng = latLng;
      this.element = document.createElement("div");
      this.element.style.position = "absolute";
      this.element.style.willChange = "transform";
    }

    setLatLng(latLng: google.maps.LatLng) {
      this.latLng = latLng;
      this.draw();
    }

    override onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(this.element);
    }

    override draw() {
      const projection = this.getProjection();
      const point = projection?.fromLatLngToDivPixel(this.latLng);
      if (!point) return;
      this.element.style.left = `${point.x}px`;
      this.element.style.top = `${point.y}px`;
      this.element.style.transform =
        anchor === "bottom" ? "translate(-50%, -100%)" : "translate(-50%, -50%)";
    }

    override onRemove() {
      this.element.parentNode?.removeChild(this.element);
    }
  }

  const overlay = new Overlay(new google.maps.LatLng(position.lat, position.lng));
  overlay.setMap(map);

  return {
    element: overlay.element,
    setPosition: (next) => overlay.setLatLng(new google.maps.LatLng(next.lat, next.lng)),
    remove: () => overlay.setMap(null),
  };
}

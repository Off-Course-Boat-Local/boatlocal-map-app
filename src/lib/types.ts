// Boat Local Map App — shared types for the map spike.
// These mirror the PRD §12 data model, trimmed to what the spike needs.

export type CategoryId =
  | "boats"
  | "breakfast"
  | "lunch"
  | "coffee"
  | "drinks"
  | "see"
  | "photo"
  | "shop";

export interface Category {
  id: CategoryId;
  label: string;
  /** Pin fill colour. Categories keep their own colour across all brands. */
  color: string;
  /** Inline SVG path data for the glyph, drawn in a 24x24 viewBox. */
  glyph: string;
}

export interface Brand {
  id: string;
  /** Company name, e.g. "Hotel V Nesplein" */
  companyName: string;
  /** App name shown in the header, e.g. "Jan's Amsterdam" */
  appName: string;
  primary: string;
  primaryDark: string;
  accent: string;
  /** Page surround behind the phone frame on desktop. */
  surround: string;
}

export interface Place {
  id: string;
  name: string;
  category: CategoryId;
  /** Neighbourhood or nearest landmark — shown as the card subtitle prefix. */
  area: string;
  address: string;
  lng: number;
  lat: number;
  /** The guide's personal note. This replaces Google's editorial summary. */
  note: string;
  /** Guide-entered, free text. Replaces Google opening hours. */
  hours: string;
  /** Guide-uploaded. Multiple, swipeable. First is the card thumbnail. */
  photos: string[];
}

export interface BoatTour {
  id: string;
  name: string;
  /** Departure point — shown as the card subtitle prefix. */
  area: string;
  lng: number;
  lat: number;
  /** e.g. "90 min · €28 pp · drinks incl." */
  meta: string;
  note: string;
  bookingUrl: string;
  photos: string[];
  position: number;
}

export interface Guide {
  name: string;
  slug: string;
  welcome: string;
  avatarInitial: string;
}

/** Geolocation states the map must handle. All four are real. */
export type LocationState =
  | { status: "loading" }
  | { status: "granted"; lng: number; lat: number; accuracy: number }
  | { status: "denied" }
  | { status: "unavailable" };

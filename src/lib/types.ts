// Boat Local Map App — shared types for the map spike.
// These mirror the PRD §12 data model, trimmed to what the spike needs.

import type { LucideIcon } from "lucide-react";

export type CategoryId =
  | "boats"
  | "breakfast"
  | "lunch"
  | "coffee"
  | "drinks"
  | "dancing"
  | "see"
  | "photo"
  | "shop";

export interface Category {
  id: CategoryId;
  label: string;
  /** Pin fill colour. Categories keep their own colour across all brands. */
  color: string;
  /**
   * The category's Lucide icon component (was hand-drawn SVG path data
   * before the founder's UI audit — Lucide is the one icon language across
   * the whole product now, same set the portal sidebars use).
   */
  glyph: LucideIcon;
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
  /** categories[0] is primary (pin colour/icon) — array order is priority order. */
  categories: CategoryId[];
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
  /** e.g. "90 min · €28 pp · drinks incl." — combined legacy fallback, used when durationLabel/priceLabel are null (an admin-curated tour with no BoatLocal sync data). */
  meta: string;
  /** "1 hour & 30 mins" alone — set only for a BoatLocal-synced tour. */
  durationLabel: string | null;
  /** "from €15.95 pp" alone — set only for a BoatLocal-synced tour. */
  priceLabel: string | null;
  note: string;
  bookingUrl: string;
  photos: string[];
  position: number;
}

export interface Guide {
  /**
   * The real guide id (GuideRecord.id) — optional because the map spike's
   * demo data (src/lib/data.ts's GUIDE constant) has no backing row to draw
   * one from. Every real guest request resolves this via getGuide() ->
   * toGuideView() (src/lib/data/source.ts), which always sets it. Needed so
   * the guest screens can attribute a "boat_book_click"/"app_open" event to
   * this specific guide, not just the company — see GuestPinAction's doc
   * comment in src/lib/guestActions.ts for why that matters.
   */
  id?: string;
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

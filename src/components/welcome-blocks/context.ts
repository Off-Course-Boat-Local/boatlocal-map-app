import type { MapPin } from "@/lib/data";
import type { Brand } from "@/lib/types";
import type { ReviewPlatform } from "@/types/welcome-blocks";

/** Everything a block view needs beyond its own content, resolved once by the page. */
export interface WelcomeBlockContext {
  brand: Brand;
  guideName: string;
  guideAvatarInitial: string;
  /** Preserved `?company=`/`?guide=` query string — see src/lib/guestLinks.ts. */
  qs: string;
  /** Places referenced by featured_places blocks, keyed by id. Missing ids are skipped. */
  pinsById: Record<string, MapPin>;
  /** Tour referenced by boat_tour_card (or the tenant's default featured tour). */
  boatTour: MapPin | null;
  /** Review destinations per platform; platforms without a URL are not rendered. */
  reviewUrls: Partial<Record<ReviewPlatform, string>>;
}

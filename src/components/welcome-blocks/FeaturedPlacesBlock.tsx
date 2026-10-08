import Link from "next/link";

import RatingBadge from "@/components/map/RatingBadge";
import { withGuestQuery } from "@/lib/guestLinks";
import { photoUrl } from "@/lib/photoUrl";
import type { FeaturedPlacesContent } from "@/types/welcome-blocks";
import type { WelcomeBlockContext } from "./context";

export function FeaturedPlacesBlock({ content, ctx }: { content: FeaturedPlacesContent; ctx: WelcomeBlockContext }) {
  const pins = content.placeIds.map((id) => ctx.pinsById[id]).filter(Boolean);
  if (pins.length === 0) return null;
  return (
    <section aria-label="Featured places" className="flex flex-col gap-3">
      {pins.map((pin) => {
        const params = new URLSearchParams(ctx.qs);
        params.set("place", pin.id);
        const photo = pin.photos?.[0];
        return (
          <Link
            key={pin.id}
            href={withGuestQuery("/map", params.toString())}
            className="block overflow-hidden rounded-2xl border border-[#E3E4E8] bg-white transition hover:shadow-md"
          >
            {photo && (
              <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(photo, { width: 640 })}
                  alt={pin.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                {content.showDiscountBadge && (
                  <span
                    className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                    style={{ background: ctx.brand.accent }}
                  >
                    Guest discount
                  </span>
                )}
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-[#17181C]">{pin.name}</h3>
                {!photo && content.showDiscountBadge && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                    style={{ background: ctx.brand.accent }}
                  >
                    Guest discount
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <p className="text-xs text-[#6B7280]">{pin.area}</p>
                {pin.googleRating != null && (
                  <RatingBadge
                    rating={pin.googleRating}
                    reviewCount={pin.googleReviewCount}
                    style={{ fontSize: "0.75rem" }}
                  />
                )}
              </div>
              {pin.note && <p className="mt-2 text-sm text-[#17181C]">{pin.note}</p>}
            </div>
          </Link>
        );
      })}
    </section>
  );
}

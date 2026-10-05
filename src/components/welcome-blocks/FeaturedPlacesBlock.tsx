import Link from "next/link";

import { withGuestQuery } from "@/lib/guestLinks";
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
        return (
          <Link
            key={pin.id}
            href={withGuestQuery("/map", params.toString())}
            className="block rounded-2xl border border-[#E3E4E8] bg-white p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold text-[#17181C]">{pin.name}</h3>
              {content.showDiscountBadge && (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                  style={{ background: ctx.brand.accent }}
                >
                  Guest discount
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[#6B7280]">{pin.area}</p>
            {pin.note && <p className="mt-2 text-sm text-[#17181C]">{pin.note}</p>}
          </Link>
        );
      })}
    </section>
  );
}

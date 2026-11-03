import { Clock } from "lucide-react";

import { photoUrl } from "@/lib/photoUrl";
import type { BoatTourCardContent } from "@/types/welcome-blocks";
import type { WelcomeBlockContext } from "./context";

export function BoatTourCardBlock({
  content,
  ctx,
}: {
  content: BoatTourCardContent;
  ctx: WelcomeBlockContext;
}) {
  const tour = ctx.boatTour;
  if (!tour) return null;
  const photo = tour.photos[0] ? photoUrl(tour.photos[0], { width: 240 }) : "";
  const detail = tour.durationLabel
    ? [tour.durationLabel, tour.priceLabel].filter(Boolean).join(" · ")
    : (tour.priceLabel ?? tour.meta);
  return (
    <section className="rounded-3xl border border-[#E1E7EE] bg-white p-4">
      <div className="flex items-start gap-3">
        {photo && (
          <div className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[18px] bg-[#EDF1F5]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="h-full w-full object-cover" />
            {tour.photos.length > 1 && (
              <span
                aria-hidden="true"
                className="absolute bottom-1 right-1 rounded-full bg-[rgba(16,20,28,0.55)] px-1.5 text-[10px] font-semibold leading-[14px] text-white"
              >
                {tour.photos.length}
              </span>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-semibold leading-[22px] tracking-tight text-[#0B1421]">
            {tour.name}
          </h3>
          <p className="mt-1 flex items-start gap-[5px] text-xs leading-4 text-[#657386]">
            <Clock size={14} aria-hidden="true" className="mt-px shrink-0" />
            <span>{detail}</span>
          </p>
          {tour.note && (
            <p className="mt-1.5 line-clamp-3 text-[13.5px] leading-[19px] text-[#334051]">
              {tour.note}
            </p>
          )}
        </div>
      </div>
      {tour.bookingUrl && (
        <a
          href={tour.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3.5 flex h-11 items-center justify-center rounded-full text-[15px] font-semibold text-white"
          style={{ background: ctx.brand.primary }}
        >
          Book now
        </a>
      )}
    </section>
  );
}

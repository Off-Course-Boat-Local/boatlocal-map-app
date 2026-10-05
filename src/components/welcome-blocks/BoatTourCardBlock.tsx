import type { BoatTourCardContent } from "@/types/welcome-blocks";
import type { WelcomeBlockContext } from "./context";

export function BoatTourCardBlock({ content, ctx }: { content: BoatTourCardContent; ctx: WelcomeBlockContext }) {
  const tour = ctx.boatTour;
  if (!tour) return null;
  return (
    <section className="rounded-2xl border border-[#E3E4E8] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ctx.brand.primary }}>
        {content.headline || "Back on the water"}
      </p>
      <h3 className="mt-1 text-base font-semibold text-[#17181C]">{tour.name}</h3>
      <p className="mt-0.5 text-xs text-[#6B7280]">{tour.durationLabel ?? tour.meta}</p>
      {tour.priceLabel && <p className="mt-1 text-sm font-semibold text-[#17181C]">{tour.priceLabel}</p>}
      {tour.bookingUrl && (
        <a
          href={tour.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded-full px-4 py-2 text-sm font-semibold text-white"
          style={{ background: ctx.brand.primary }}
        >
          Book now
        </a>
      )}
    </section>
  );
}

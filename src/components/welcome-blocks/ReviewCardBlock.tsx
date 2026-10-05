import type { ReviewCardContent, ReviewPlatform } from "@/types/welcome-blocks";
import type { WelcomeBlockContext } from "./context";

const PLATFORM_LABEL: Record<ReviewPlatform, string> = {
  tripadvisor: "TripAdvisor",
  google: "Google",
  guruwalk: "GuruWalk",
};

export function ReviewCardBlock({ content, ctx }: { content: ReviewCardContent; ctx: WelcomeBlockContext }) {
  const urlFor = (p: ReviewPlatform) => content.urls?.[p] || ctx.reviewUrls[p];
  const links = content.platforms.filter((p) => urlFor(p));
  return (
    <section className="rounded-2xl border border-[#E3E4E8] bg-white p-4">
      <p aria-hidden="true" className="text-lg tracking-widest" style={{ color: ctx.brand.accent }}>
        ★★★★★
      </p>
      <h2 className="mt-1 text-base font-semibold text-[#17181C]">{content.promptText || "Leave a review"}</h2>
      {links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {links.map((p) => (
            <a
              key={p}
              href={urlFor(p)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[#E3E4E8] px-3 py-1.5 text-sm font-medium text-[#17181C]"
            >
              {PLATFORM_LABEL[p]}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

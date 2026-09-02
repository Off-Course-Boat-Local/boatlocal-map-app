"use client";

// The 5-star row, shared by the Review screen and the browse-triggered
// prompt drawer.
//
// TAPPING ANY STAR SENDS THE GUEST STRAIGHT TO THE COMPANY'S OWN REVIEW
// LINK — whichever platform they configured in Studio (Google or
// Tripadvisor; see getReviewOptions in src/lib/guestReview.ts). Founder,
// 2026-09-02: "when people click the 5 stars, automatically go to the set
// review link set in the dashboard by the studio owner."
//
// THIS IS NOT REVIEW GATING, and the distinction matters enough to write
// down: EVERY rating goes to the SAME place. A one-star tap and a five-star
// tap open the identical public review page. What's forbidden — and what
// this deliberately does not do — is routing happy guests to the public
// page while quietly diverting unhappy ones to a private form. The founder
// ruled that out explicitly ("dont do review gating"), and it's also what
// Google and Tripadvisor's own policies prohibit.
//
// The rating itself is still recorded before the hand-off, so the tenant
// keeps the full distribution rather than only learning about the guests
// who completed a review on someone else's site.

import { useState } from "react";
import { Star } from "lucide-react";

import { BORDER } from "@/lib/guestTheme";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export interface ReviewStarsProps {
  /** Where every star tap leads, regardless of the number picked. */
  reviewUrl: string;
  /** Fired before the hand-off, with the rating the guest actually picked. */
  onRate?: (rating: number) => void;
  size?: "md" | "lg";
}

export default function ReviewStars({ reviewUrl, onRate, size = "lg" }: ReviewStarsProps) {
  const { t } = useI18n();
  // Purely visual: the stars fill in under the finger for the instant
  // before the new tab opens, so the tap registers as having done
  // something. Nothing downstream reads it.
  const [picked, setPicked] = useState(0);

  const starSize = size === "lg" ? "h-9 w-9" : "h-8 w-8";

  return (
    <div className="flex justify-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <a
          key={n}
          href={reviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.review.starLabel(n)}
          onClick={() => {
            setPicked(n);
            onRate?.(n);
          }}
          className="p-1 transition-transform active:scale-90"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          <Star
            className={starSize}
            style={{ color: n <= picked ? "var(--brand-primary)" : BORDER }}
            fill={n <= picked ? "var(--brand-primary)" : "none"}
          />
        </a>
      ))}
    </div>
  );
}

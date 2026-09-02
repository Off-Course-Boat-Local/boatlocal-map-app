"use client";

// The browse-triggered review ask: a bottom drawer that appears once a
// guest has opened PLACES_VIEWED_BEFORE_PROMPT distinct recommendations
// (src/lib/reviewPrompt.ts). Founder, 2026-09-02: "when 4 locations have
// been viewed, prompt the same 5 star review drawer from the bottom to ask
// i hope you enjoy our recommendations, please leave a review as it would
// greatly help our business. and then the guides name who shared it."
//
// WHY THIS MOMENT: someone who has opened four places has actually used
// the guide, which is the earliest point the ask is honest. It's the same
// reasoning as the arrival prompt (GuestMapScreen) — ask when the guest has
// just received the value, not on arrival at the app.
//
// Shown at most once per visit, and never on top of the arrival prompt's
// own moment — both latch through sessionStorage in reviewPrompt.ts.
//
// Same drawer language as PlaceCard's `asDrawer` (fixed to the bottom,
// covering the nav, big clear close affordance) — a guest already knows
// what a sheet from the bottom of this app looks like.

import { X } from "lucide-react";

import ReviewStars from "./ReviewStars";
import { bodyFontFamily, displayFontFamily } from "@/lib/fonts";
import { BORDER, INK, MUTED, SHADOW_FLOAT } from "@/lib/guestTheme";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export interface ReviewPromptDrawerProps {
  /** Where a star tap leads — the tenant's own configured review link. */
  reviewUrl: string;
  /**
   * Who the ask is signed by: the guide who actually shared this guide when
   * there is one, otherwise the company. Never the app's generic "your
   * guide" placeholder — an unsigned plea reads like spam.
   */
  signature: string;
  onRate?: (rating: number) => void;
  onClose: () => void;
}

export default function ReviewPromptDrawer({
  reviewUrl,
  signature,
  onRate,
  onClose,
}: ReviewPromptDrawerProps) {
  const { t } = useI18n();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.review.promptTitle}
      className="fixed inset-x-0 bottom-0 z-50"
      style={{
        background: "#FFFFFF",
        borderTop: `1px solid ${BORDER}`,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        boxShadow: SHADOW_FLOAT,
        paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)",
        // Matches PlaceCard's drawer entrance — deliberately snappy, the
        // founder called the old slower one out by name.
        animation: "review-prompt-in 180ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <style>{`@keyframes review-prompt-in { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

      <button
        type="button"
        onClick={onClose}
        aria-label={t.common.close}
        className="absolute right-3 top-3 grid size-9 place-items-center rounded-full"
        style={{ background: "#F1F5F9", color: MUTED, WebkitTapHighlightColor: "transparent" }}
      >
        <X className="size-4" aria-hidden />
      </button>

      <div className="px-6 pt-7 text-center">
        <p
          style={{ fontFamily: displayFontFamily, fontWeight: 600, fontSize: 17, color: INK }}
        >
          {t.review.promptTitle}
        </p>
        <p
          className="mx-auto mt-2 max-w-[19rem] text-[13.5px] leading-snug"
          style={{ color: MUTED, fontFamily: bodyFontFamily }}
        >
          {t.review.promptBody}
        </p>

        <div className="mt-4">
          <ReviewStars reviewUrl={reviewUrl} onRate={onRate} />
        </div>

        <p
          className="mt-4 text-[12.5px]"
          style={{ color: MUTED, fontFamily: bodyFontFamily }}
        >
          {t.review.promptSignature(signature)}
        </p>
      </div>
    </div>
  );
}

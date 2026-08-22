"use client";

// The guest Review screen (PRD §5.6) — the COMPANY review ask only.
//
// HARD RULES this screen exists to satisfy (see src/app/(guest)/review/page.tsx
// for the full text, and CLAUDE project rules):
//   - This is flow (a) of the two SEPARATE review flows: the company's own
//     Google/Tripadvisor link. The boat-tour review flow is different and
//     out of scope here.
//   - No star ratings, review counts, or any crowd-rating UI anywhere —
//     this screen must not render a tap-to-rate control of any kind, even
//     a private/non-aggregated one. Every guest sees the exact same public
//     review buttons.
//   - "Share private feedback instead" is rendered with the SAME visual
//     weight as the public review buttons — an equal option, not a
//     low-rating escape hatch, not visually buried.
//   - "Maybe later" is a genuine no-consequence skip.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { bodyFontFamily, displayFontFamily } from "@/lib/fonts";
import { recordGuestEvent } from "@/lib/guestEvents";
import type { ReviewOption } from "@/lib/guestReview";
import { reviewClickEventType } from "@/lib/guestReview";
import { guestQueryString, withGuestQuery } from "@/lib/guestLinks";

const INK = "#17181C";
const MUTED = "#6B7280";
const BORDER = "#E3E4E8";

const buttonBase = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 12,
  padding: "13px 16px",
  fontSize: 14.5,
  fontWeight: 600,
  fontFamily: bodyFontFamily,
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation",
} as const;

export interface GuestReviewScreenProps {
  companyName: string;
  companyId: string | null;
  reviewOptions: ReviewOption[];
}

export default function GuestReviewScreen({
  companyName,
  companyId,
  reviewOptions,
}: GuestReviewScreenProps) {
  const searchParams = useSearchParams();
  const mapHref = withGuestQuery("/map", guestQueryString(searchParams));

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  const [isPending, startTransition] = useTransition();

  const handleReviewClick = (option: ReviewOption) => {
    // The link navigates (new tab) regardless of what happens here — a
    // failed or slow analytics write must never stand between a guest and
    // actually leaving a review. `guideId` is deliberately omitted (left
    // null): the ask is branded to the COMPANY, not to whichever guide's
    // link the guest arrived on, so review analytics roll up under the
    // company only (see getCompanyAnalyticsSummary, not
    // getGuideAnalyticsSummary, in src/lib/data/source.ts).
    startTransition(async () => {
      await recordGuestEvent({
        eventType: reviewClickEventType(option.platform),
        companyId,
        guideId: null,
        metadata: {},
      });
    });
  };

  // Private feedback has no dedicated table in today's schema (see the
  // tables list in supabase/migrations/20260805063610_init_schema.sql —
  // there is no `feedback` table). Until one exists, the guest's free text
  // is carried in this event's `metadata.feedback`, which is enough to make
  // "share private feedback instead" a real path rather than a dead end.
  // TODO: once a dedicated feedback table/flow exists, insert there instead
  // of overloading `events.metadata`.
  const handleFeedbackSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = feedbackText.trim();
    if (!text) return;
    startTransition(async () => {
      await recordGuestEvent({
        eventType: "review_private_feedback",
        companyId,
        guideId: null,
        metadata: { feedback: text },
      });
      setFeedbackSent(true);
    });
  };

  const placeholderNotice = reviewOptions.find((option) => option.isPlaceholder);

  return (
    <div
      className="no-scrollbar flex h-full flex-col overflow-y-auto px-6"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* `my-auto` (not justify-center on the scroller) vertically centres
          the ask when there's room, and degrades to normal top-aligned
          scrolling when there isn't — justify-center on an overflowing flex
          container clips its top edge unreachably. The audit flagged this
          screen's old top-stacked layout: content in the top third, then a
          dead two-thirds of blank white before a floating "Maybe later". */}
      <div className="my-auto flex flex-col gap-7 py-8">
        {/* Branded ask ------------------------------------------------ */}
        <div className="text-center">
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: MUTED, fontFamily: bodyFontFamily }}
          >
            Your trip
          </p>
          <h1
            className="mx-auto mt-2 max-w-sm text-[26px] leading-snug"
            style={{ color: INK, fontFamily: displayFontFamily }}
          >
            Did you enjoy your experience with {companyName}?
          </h1>
        </div>

      {/* Public review link(s) — flow (a) ------------------------------ */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold" style={{ color: INK, fontFamily: bodyFontFamily }}>
          Leave a public review
        </p>
        <div className="flex flex-col gap-2">
          {reviewOptions.map((option) => (
            <a
              key={option.platform}
              href={option.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleReviewClick(option)}
              style={{
                ...buttonBase,
                background: "var(--brand-primary)",
                color: "#FFFFFF",
              }}
            >
              Review us on {option.label}
            </a>
          ))}
        </div>
        {placeholderNotice && (
          <p className="text-xs" style={{ color: MUTED, fontFamily: bodyFontFamily }}>
            {companyName} hasn&rsquo;t set up a review link yet — this opens a
            plain Google search instead.
          </p>
        )}
      </div>

      {/* Equal, non-hidden option: private feedback -------------------- */}
      <div className="flex flex-col gap-2">
        {!feedbackOpen && !feedbackSent && (
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            style={{
              ...buttonBase,
              background: "#FFFFFF",
              color: INK,
              border: `1px solid ${BORDER}`,
            }}
          >
            Share private feedback instead
          </button>
        )}

        {feedbackOpen && !feedbackSent && (
          <form onSubmit={handleFeedbackSubmit} className="flex flex-col gap-2">
            <label
              htmlFor="private-feedback"
              className="text-sm font-semibold"
              style={{ color: INK, fontFamily: bodyFontFamily }}
            >
              Tell {companyName} directly
            </label>
            <textarea
              id="private-feedback"
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              rows={4}
              placeholder="What could have been better?"
              style={{
                borderRadius: 12,
                border: `1px solid ${BORDER}`,
                padding: "10px 12px",
                fontSize: 14,
                fontFamily: bodyFontFamily,
                color: INK,
                resize: "vertical",
              }}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending || feedbackText.trim().length === 0}
                style={{
                  ...buttonBase,
                  flex: "1 1 auto",
                  background: "var(--brand-primary)",
                  color: "#FFFFFF",
                  opacity: isPending || feedbackText.trim().length === 0 ? 0.6 : 1,
                }}
              >
                Send feedback
              </button>
              <button
                type="button"
                onClick={() => {
                  setFeedbackOpen(false);
                  setFeedbackText("");
                }}
                style={{
                  ...buttonBase,
                  background: "#FFFFFF",
                  color: MUTED,
                  border: `1px solid ${BORDER}`,
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {feedbackSent && (
          <p
            style={{
              borderRadius: 12,
              background: "#F4F5F7",
              color: INK,
              fontFamily: bodyFontFamily,
              padding: "13px 16px",
              fontSize: 14,
            }}
          >
            Thanks — that&rsquo;s been passed along to {companyName}.
          </p>
        )}
      </div>

      {/* Soft skip — kept INSIDE the centred block (not a separate flex
          child) so it sits right under the buttons as one visual group,
          instead of the auto-margin centring leaving a second dead gap
          between the buttons and a "Maybe later" stranded near the tab
          bar. */}
      <div className="text-center">
        <Link
          href={mapHref}
          className="text-sm font-semibold"
          style={{
            color: MUTED,
            fontFamily: bodyFontFamily,
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          Maybe later
        </Link>
      </div>
      </div>
    </div>
  );
}

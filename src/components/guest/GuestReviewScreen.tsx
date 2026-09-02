"use client";

// The guest Review screen (PRD §5.6) — the COMPANY review ask only.
//
// HARD RULES this screen exists to satisfy (see src/app/(guest)/review/page.tsx
// for the full text, and CLAUDE project rules):
//   - This is flow (a) of the two SEPARATE review flows: the company's own
//     Google/Tripadvisor link. The boat-tour review flow is different and
//     out of scope here.
//   - A 5-star rating widget IS shown. Founder, 2026-09-02: "lets not do the
//     5 stars. or when people click the 5 stars, automatically go to the set
//     review link set in the dashboard by the studio owner" — so a tap on
//     ANY star (via the shared ReviewStars component, see ReviewStars.tsx's
//     own header comment for the non-gating rule) now records the rating
//     AND immediately opens the company's configured review link in a new
//     tab, same as tapping the explicit option card below. When there's no
//     real link yet (only a placeholder — see `placeholderNotice`), the
//     stars fall back to a plain tap-to-rate control that just drives
//     emphasis, since there's nowhere real to send the guest.
//     What still hasn't changed, and remains a HARD rule: both options below
//     the stars must stay rendered, fully clickable, and never `disabled`,
//     at EVERY rating value including rating === 0 (before any star is
//     picked) — the rating may only ever change which option LOOKS
//     emphasized, never which one exists in the DOM or can be tapped. See
//     GuestReviewScreen.test.tsx for the test that actually enforces this,
//     not just documents it.
//   - "Share private feedback instead" is rendered with the SAME visual
//     weight as the public review buttons at rating 0 — an equal option,
//     not a low-rating escape hatch, not visually buried.
//   - "Maybe later" is a genuine no-consequence skip.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Lock, Star } from "lucide-react";

import { GuestScreenHeader } from "./GuestScreenHeader";
import ReviewStars from "./ReviewStars";
import { bodyFontFamily, displayFontFamily } from "@/lib/fonts";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { recordGuestEvent, recordGuestReview } from "@/lib/guestEvents";
import type { ReviewOption, ReviewPlatform } from "@/lib/guestReview";
import { reviewClickEventType } from "@/lib/guestReview";
import { guestQueryString, withGuestQuery } from "@/lib/guestLinks";
import {
  BORDER,
  BRAND_TINT,
  INK,
  MUTED,
  SECONDARY,
  SHADOW_CARD,
} from "@/lib/guestTheme";

const SWATCH_BG = SECONDARY;
/** Emphasis tint — derived from the company's own brand colour, never a hardcoded blue (guestTheme keeps this in lockstep with the reference's --brand-tint). */
const EMPHASIS_TINT = BRAND_TINT;

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

/** Standard four-colour "G" mark — icon only, no wordmark. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

/** Simplified twin-circle mark, evocative of Tripadvisor's own icon without reproducing it pixel-for-pixel. */
function TripadvisorMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <circle cx="7" cy="13" r="5" fill="none" stroke="#34E0A1" strokeWidth="2" />
      <circle cx="17" cy="13" r="5" fill="none" stroke="#34E0A1" strokeWidth="2" />
      <circle cx="7" cy="13" r="2" fill="#00594C" />
      <circle cx="17" cy="13" r="2" fill="#00594C" />
      <path d="M12 6 9 9M12 6l3 3" stroke="#34E0A1" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function ReviewPlatformIcon({ platform }: { platform: ReviewPlatform }) {
  return platform === "google" ? <GoogleMark /> : <TripadvisorMark />;
}

/**
 * Icon-swatch + title/subtitle row shared by both options below, matching
 * the reference design's card shape (rounded-2xl border p-4, h-10 w-10
 * rounded-xl icon swatch). `emphasized` drives border/tint colour only —
 * never whether the row renders, and never `disabled`.
 */
function OptionRow({
  icon,
  title,
  subtitle,
  emphasized,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  emphasized: boolean;
  badge?: string;
}) {
  return (
    <>
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
        style={{ background: SWATCH_BG }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block text-[0.9375rem] font-semibold"
          style={{ color: INK, fontFamily: displayFontFamily }}
        >
          {title}
        </span>
        <span className="block text-[0.8125rem]" style={{ color: MUTED, fontFamily: bodyFontFamily }}>
          {subtitle}
        </span>
      </span>
      {badge && emphasized && (
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[0.625rem] font-semibold tracking-wide uppercase"
          style={{ background: "var(--brand-primary)", color: "#FFFFFF" }}
        >
          {badge}
        </span>
      )}
    </>
  );
}

function cardStyle(emphasized: boolean) {
  return {
    border: `1px solid ${emphasized ? "var(--brand-primary)" : BORDER}`,
    background: emphasized ? EMPHASIS_TINT : "#FFFFFF",
  };
}

/**
 * Below this many collected ratings, the social-proof line stays hidden —
 * "join 2 guests" reads as weak evidence, not strong. Every guest sees the
 * same number regardless of their own (or any) rating, so raising/lowering
 * this only changes when the line appears, never who sees what.
 */
const MIN_REVIEWS_FOR_SOCIAL_PROOF = 5;

export interface GuestReviewScreenProps {
  companyName: string;
  companyId: string | null;
  reviewOptions: ReviewOption[];
  logoUrl?: string | null;
  /** How many guests have rated so far (this app's own guest_reviews, not a public platform's rating) — see getCompanyReviewStats in src/lib/data/source.ts. */
  reviewCount?: number;
}

export default function GuestReviewScreen({
  companyName,
  companyId,
  reviewOptions,
  logoUrl,
  reviewCount = 0,
}: GuestReviewScreenProps) {
  const searchParams = useSearchParams();
  const mapHref = withGuestQuery("/map", guestQueryString(searchParams));
  const { t } = useI18n();

  const [rating, setRating] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  const [isPending, startTransition] = useTransition();

  // Three visual buckets, but only two of them actually change which OPTION
  // is emphasized — rating === 0 is a true neutral (neither option
  // emphasized) for a softer first impression, rather than defaulting
  // straight into "private feedback" emphasis the way a strict
  // `positive ? public : private` split would. Either reading is a fair
  // implementation of the reference design (see this screen's own header
  // comment) — this one was chosen so an unrated guest isn't visually
  // steered before they've said anything at all.
  const positive = rating >= 4;
  const publicEmphasized = rating > 0 && positive;
  const privateEmphasized = rating > 0 && !positive;

  const eyebrowLabel =
    rating === 0
      ? t.review.eyebrowNeutral
      : positive
        ? t.review.eyebrowPositive
        : t.review.eyebrowNegative;

  const handleRate = (n: number) => {
    setRating(n);
    // Captures the full rating distribution, not just the subset of guests
    // who go on to open the private-feedback form below — see
    // supabase/migrations/20260824000000_guest_reviews.sql's own comment for
    // why a bare star pick is its own row rather than only being recorded on
    // submit. Skipped entirely (never blocks setRating above) when there is
    // no real tenant to attribute it to.
    if (!companyId) return;
    startTransition(async () => {
      await recordGuestReview({ companyId, rating: n });
    });
  };

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

  const handleFeedbackSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = feedbackText.trim();
    if (!text) return;
    startTransition(async () => {
      if (companyId) {
        await recordGuestReview({
          companyId,
          // rating is 0 until a star is picked, but the private-feedback
          // option is reachable without one (it's fully clickable at every
          // rating, including 0 — see this file's header comment) and the
          // table's check constraint only allows 1-5 or null, never 0.
          rating: rating > 0 ? rating : null,
          feedbackText: text,
          contact: feedbackContact.trim() || null,
        });
      }
      setFeedbackSent(true);
    });
  };

  const placeholderNotice = reviewOptions.find((option) => option.isPlaceholder);
  // The first real (non-placeholder) review link — where a star tap sends
  // the guest. Null only when the company hasn't configured a real link
  // yet, in which case the stars fall back to tap-to-rate-only (see header
  // comment).
  const starOption = reviewOptions.find((option) => !option.isPlaceholder) ?? null;

  const handleStarRate = (n: number) => {
    handleRate(n);
    // Same analytics event as the explicit review card below — a star tap
    // is just a faster path to the identical hand-off, so it should roll up
    // the same way.
    if (starOption) handleReviewClick(starOption);
  };

  return (
    <div className="flex h-full w-full flex-col">
      {/* Gradient header band (reference review.tsx) — replaces the old
          centred "Your trip / Did you enjoy…" heading block. */}
      <GuestScreenHeader
        eyebrow={t.review.eyebrow}
        title={t.review.title}
        subtitle={t.review.subtitle(companyName)}
        logoUrl={logoUrl}
      />

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto bg-white px-5 py-6">
        <div className="flex flex-col gap-5">
        {/* Social proof — a real count from this app's own guest_reviews
            (see getCompanyReviewStats), not a fabricated number. Shown to
            every guest identically regardless of rating: this is a trust
            signal, not a gating mechanism. */}
        {reviewCount >= MIN_REVIEWS_FOR_SOCIAL_PROOF && (
          <p className="text-center text-[0.8125rem]" style={{ color: MUTED, fontFamily: bodyFontFamily }}>
            {t.review.socialProof(reviewCount)}
          </p>
        )}
        {/* Star rating — emphasis + copy only, never gating (see header).
            Wrapped in the reference's white shadow-card section. */}
        <section
          className="rounded-2xl p-5"
          style={{
            background: "#FFFFFF",
            border: `1px solid ${BORDER}`,
            boxShadow: SHADOW_CARD,
          }}
        >
          <h2
            className="text-center text-base font-semibold"
            style={{ color: INK, fontFamily: displayFontFamily }}
          >
            {t.review.rateTitle(companyName)}
          </h2>
          <div className="mt-4">
            {starOption ? (
              <ReviewStars reviewUrl={starOption.url} onRate={handleStarRate} />
            ) : (
              // No real review link configured yet — stars can only drive
              // emphasis below, there's nowhere real to send the guest.
              <div className="flex justify-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = n <= rating;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-label={t.review.starLabel(n)}
                      onClick={() => handleRate(n)}
                      className="p-1 transition-transform active:scale-90"
                      style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                    >
                      <Star
                        className="h-9 w-9"
                        style={{ color: filled ? "var(--brand-primary)" : BORDER }}
                        fill={filled ? "var(--brand-primary)" : "none"}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {rating > 0 && (
            <p
              className="mt-3 text-center text-sm"
              style={{ color: MUTED, fontFamily: bodyFontFamily }}
            >
              {positive ? t.review.positiveCaption : t.review.negativeCaption}
            </p>
          )}
        </section>

        {/* Two equal, always-rendered, always-clickable options ---------- */}
        <div className="flex flex-col gap-3">
          <p
            className="text-[0.75rem] font-semibold uppercase tracking-[0.14em]"
            style={{ color: MUTED, fontFamily: bodyFontFamily }}
          >
            {eyebrowLabel}
          </p>

          {/* Public review link(s) — flow (a) -------------------------- */}
          <div className="flex flex-col gap-2">
            {reviewOptions.map((option) => (
              <a
                key={option.platform}
                href={option.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleReviewClick(option)}
                className="flex items-center gap-3 rounded-2xl p-4 transition-colors"
                style={{ ...cardStyle(publicEmphasized), textDecoration: "none" }}
              >
                <OptionRow
                  icon={<ReviewPlatformIcon platform={option.platform} />}
                  // The platform name itself (Google, Tripadvisor) never
                  // translates — only the sentence around it.
                  title={t.review.reviewOn(option.label)}
                  subtitle={t.review.publicSubtitle}
                  emphasized={publicEmphasized}
                  badge={t.review.bestBadge}
                />
              </a>
            ))}
            {placeholderNotice && (
              <p className="text-xs" style={{ color: MUTED, fontFamily: bodyFontFamily }}>
                {t.review.placeholderNotice(companyName)}
              </p>
            )}
          </div>

          {/* Equal, non-hidden option: private feedback ------------------ */}
          <div className="flex flex-col gap-2">
            {!feedbackOpen && !feedbackSent && (
              <button
                type="button"
                onClick={() => setFeedbackOpen(true)}
                className="flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors"
                style={{
                  ...cardStyle(privateEmphasized),
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                  cursor: "pointer",
                }}
              >
                <OptionRow
                  icon={<Lock className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />}
                  title={t.review.privateTitle}
                  subtitle={t.review.privateSubtitle(companyName)}
                  emphasized={privateEmphasized}
                />
              </button>
            )}

            {feedbackOpen && !feedbackSent && (
              <form onSubmit={handleFeedbackSubmit} className="flex flex-col gap-2">
                <label
                  htmlFor="private-feedback"
                  className="text-sm font-semibold"
                  style={{ color: INK, fontFamily: bodyFontFamily }}
                >
                  {t.review.tellDirectly(companyName)}
                </label>
                <textarea
                  id="private-feedback"
                  value={feedbackText}
                  onChange={(event) => setFeedbackText(event.target.value)}
                  rows={4}
                  placeholder={t.review.feedbackPlaceholder}
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
                <label
                  htmlFor="private-feedback-contact"
                  className="text-sm font-semibold"
                  style={{ color: INK, fontFamily: bodyFontFamily }}
                >
                  {t.review.contactLabel}
                </label>
                <input
                  id="private-feedback-contact"
                  type="text"
                  value={feedbackContact}
                  onChange={(event) => setFeedbackContact(event.target.value)}
                  placeholder={t.review.contactPlaceholder}
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${BORDER}`,
                    padding: "10px 12px",
                    fontSize: 14,
                    fontFamily: bodyFontFamily,
                    color: INK,
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
                    {t.review.send}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackOpen(false);
                      setFeedbackText("");
                      setFeedbackContact("");
                    }}
                    style={{
                      ...buttonBase,
                      background: "#FFFFFF",
                      color: MUTED,
                      border: `1px solid ${BORDER}`,
                    }}
                  >
                    {t.common.cancel}
                  </button>
                </div>
              </form>
            )}

            {feedbackSent && (
              <p
                style={{
                  borderRadius: 12,
                  background: SECONDARY,
                  color: INK,
                  fontFamily: bodyFontFamily,
                  padding: "13px 16px",
                  fontSize: 14,
                }}
              >
                {t.review.thanks(companyName)}
              </p>
            )}
          </div>
        </div>

        {/* Soft skip — kept inside the same stack so it sits right under
            the buttons as one visual group. */}
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
            {t.review.maybeLater}
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}

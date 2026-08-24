// Shared visual primitives for Studio page content — the "new methodology"
// restyle's building blocks, so every page (Dashboard, Branding,
// Recommendations, Boat tours, Guides, Campaign, Report, Settings, Profile)
// composes the same card/table/stat/typography language instead of each
// re-inventing its own neutral-* classes. Modelled on the reference
// AdminShell/primitives.tsx (a fresh companion codebase's Admin restyle —
// see the restyle brief) — Panel/Eyebrow/SectionHeading/StatCard/
// StatusPill/PrimaryButton/GhostButton/TableShell/PageHeader all mirror
// that file's shapes, adapted to this codebase's own token names
// (`--studio-*`, defined in ../../app/studio/studio-theme.css) rather than
// the reference's Tailwind theme tokens, and to Studio's actual data
// shapes (StudioStatusTone covers this app's real statuses: guide invited/
// active/deactivated, company live/setup/suspended — not the reference's
// admin-only tones).
//
// Typography: Outfit (display) for headings and stat numbers, Figtree
// (body) for everything else — both loaded already via `fontVariables` in
// src/app/layout.tsx, applied here as inline `fontFamily` styles via
// src/lib/fonts.ts's `displayFontFamily`/`bodyFontFamily` exports. Inline,
// not a Tailwind `font-display` utility, because globals.css (where such a
// utility would need registering under `@theme`) belongs to the guest app,
// not Studio — the same constraint the guest components solve the same way
// (see e.g. GuestPlaceRow.tsx).

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { displayFontFamily } from "@/lib/fonts";

/** Shared card shadow — reads --studio-shadow-card (studio-theme.css), the
 *  same value Admin's own primitives.tsx reads from --admin-shadow-card, so
 *  a card looks identical in both portals. */
export const CARD_SHADOW = "shadow-[var(--studio-shadow-card)]";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Panel({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cx(
        "rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)]",
        CARD_SHADOW,
        padded && "p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--studio-ink-soft)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <h1
          style={{ fontFamily: displayFontFamily }}
          className="text-[1.75rem] leading-tight font-bold tracking-[-0.02em] text-[var(--studio-ink)]"
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--studio-ink-soft)]">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mb-4 flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        <h2
          style={{ fontFamily: displayFontFamily }}
          className="text-lg font-semibold tracking-[-0.02em] text-[var(--studio-ink)]"
        >
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-[var(--studio-ink-soft)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  caption,
  className,
}: {
  label: string;
  value: string | number;
  caption?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex h-full flex-col rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5",
        CARD_SHADOW,
        className,
      )}
    >
      <Eyebrow>{label}</Eyebrow>
      <p
        style={{ fontFamily: displayFontFamily }}
        className="mt-auto pt-3 text-[2.125rem] leading-none font-bold tracking-[-0.02em] text-[var(--studio-ink)] tabular-nums"
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {caption && <p className="mt-2.5 text-xs text-[var(--studio-ink-soft)]">{caption}</p>}
    </div>
  );
}

/**
 * Status tones this app actually has, across both statuses Studio renders:
 * a guide's `GuideStatus` (invited / active / deactivated) and a company's
 * `CompanyStatus` (active / setup / suspended). One pill component, not one
 * per status enum, since the visual language (a soft colour + a label) is
 * identical either way.
 */
export type StudioStatusTone = "positive" | "neutral" | "warning" | "danger";

const TONE_CLASSES: Record<StudioStatusTone, string> = {
  positive: "bg-emerald-50 text-emerald-700",
  neutral: "bg-[var(--studio-border)] text-[var(--studio-ink-soft)]",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-700",
};

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: StudioStatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold capitalize",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Both button variants take a `size` rather than letting callers pass
 * padding/text-size overrides through `className`: this codebase has no
 * tailwind-merge, so a caller's `className` is only ever *appended* after
 * the base classes (see `cx` above), never resolved against them — two
 * conflicting padding utilities (the base's `px-4` and a caller's `px-3`)
 * would both land in the generated stylesheet with the winner decided by
 * Tailwind's own build-order, not by prop order. `size` sidesteps that by
 * changing which padding utility is in the base string to begin with.
 */
export type StudioButtonSize = "sm" | "md";

const BUTTON_SIZE_CLASSES: Record<StudioButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
};

export interface StudioButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: StudioButtonSize;
}

export function PrimaryButton({
  children,
  className,
  size = "md",
  ...props
}: StudioButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        `inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--studio-accent)] font-semibold text-white ${CARD_SHADOW} transition-colors hover:bg-[var(--studio-accent-hover)] disabled:opacity-50`,
        BUTTON_SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  size = "md",
  ...props
}: StudioButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] font-semibold text-[var(--studio-ink)] transition-colors hover:bg-[var(--studio-bg)] disabled:opacity-50",
        BUTTON_SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TableShell({
  head,
  children,
  className,
}: {
  head: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)]",
        CARD_SHADOW,
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--studio-border)] bg-[var(--studio-bg)]/60 [&>th]:px-5 [&>th]:py-3 [&>th]:text-[0.6875rem] [&>th]:font-semibold [&>th]:tracking-[0.12em] [&>th]:whitespace-nowrap [&>th]:text-[var(--studio-ink-soft)] [&>th]:uppercase">
              {head}
            </tr>
          </thead>
          <tbody className="[&>tr:last-child]:border-0 [&>tr]:border-b [&>tr]:border-[var(--studio-border)] [&>tr]:transition-colors [&_td]:px-5 [&_td]:py-3.5 [&_td]:align-middle hover:[&>tr]:bg-[var(--studio-bg)]/50">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Shared text-input treatment, used across every Studio form field. */
export const inputClass =
  "mt-1 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3.5 py-2.5 text-sm text-[var(--studio-ink)] outline-none transition-colors focus:border-[var(--studio-accent)] focus:ring-2 focus:ring-[var(--studio-accent)]/15";

export const labelClass = "block text-sm font-medium text-[var(--studio-ink)]";

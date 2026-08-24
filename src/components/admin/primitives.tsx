import type { ReactNode } from "react";

// Small, purely-visual layout primitives shared across every Admin page —
// modelled on the reference design's own src/components/admin/primitives.tsx
// (Panel / Eyebrow / SectionHeading / PageHeader), adapted to this app's
// plain CSS-custom-property theme (src/app/admin/admin-theme.css) instead of
// the reference's Tailwind `@theme` tokens, and to Admin's own #F6F6F3 canvas
// rather than the reference's pure-white page background — see
// admin-theme.css's own comment on --admin-shadow-card for why that shadow
// pairing didn't need retuning for the darker canvas.
//
// These carry NO data-fetching or business logic — every page still owns its
// own props/loops/Server Action wiring exactly as before; this only avoids
// re-typing the same "rounded-2xl border shadow-card p-5" wrapper on every
// page.

export function Panel({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow-card)] ${
        padded ? "p-5" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--admin-ink-soft)] ${className}`}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  className = "",
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 flex flex-wrap items-end justify-between gap-3 ${className}`}>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[var(--admin-ink)]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--admin-ink-soft)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  hint,
  action,
}: {
  title: string;
  description?: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-[var(--admin-ink)]">
          {title}
        </h1>
        {description ? <p className="mt-1.5 text-sm text-[var(--admin-ink-soft)]">{description}</p> : null}
        {hint ? <div className="mt-2 text-sm text-[var(--admin-ink-soft)]">{hint}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/** Shared class string for a solid, accent-filled call-to-action — kept as a
 *  plain string (not a `<button>` wrapper component) so every existing call
 *  site (`<button>`, `<Link>`, a `<form>`'s submit control, disabled states)
 *  can keep its own element/handler untouched and just swap classNames. */
export const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--admin-accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--admin-shadow-card)] transition-colors hover:bg-[var(--admin-accent-hover)] disabled:opacity-50";

/** Shared class string for a secondary/ghost action — outline, no fill. */
export const GHOST_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5 text-sm font-medium text-[var(--admin-ink)] transition-colors hover:bg-[var(--admin-bg)] disabled:opacity-50";

/** Shared class string for a form input / textarea / select trigger. */
export const FIELD_CLASS =
  "w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3.5 py-2.5 text-sm text-[var(--admin-ink)] outline-none transition-shadow focus:border-[var(--admin-accent)] focus:ring-2 focus:ring-[var(--admin-accent)]/15";

export const FIELD_LABEL_CLASS = "block text-sm font-medium text-[var(--admin-ink)]";

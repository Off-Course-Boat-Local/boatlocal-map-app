"use client";

// A custom-styled dropdown for the shared Admin/Studio portal design (see
// MapAppMark.tsx's header comment) — replaces the native <select> browser
// chrome (different font, different border-radius, an OS-drawn popup that
// can't be themed at all) with a listbox that actually matches the rest of
// the portal.
//
// Still a REAL form field: a hidden <input type="hidden" name={name}>
// carries the value, kept in sync with the visible button+listbox via
// React state. That means this drops into an existing plain
// `<form method="get">` (src/app/admin/(protected)/analytics/page.tsx) or a
// Server Action's FormData submission (CreateCompanyForm, BoatTourForm,
// RecommendationForm) with zero change to how either reads its fields —
// both just read whatever the hidden input's DOM value is at submit time.
//
// Colours read CSS custom properties with a fallback, not a hardcoded hex,
// so the same component looks native to both surfaces: inside Admin's
// `.admin-root` it picks up `--admin-*` (src/app/admin/admin-theme.css);
// outside it (Studio, which has no such scope) it falls back to a neutral
// palette matching Studio's existing hardcoded Tailwind neutral-*/PORTAL_ACCENT
// colours.
//
// Deliberately not exposing `required` — a hidden input is excluded from
// HTML constraint validation entirely (per spec), so client-side "you must
// pick one" enforcement would need to be reimplemented by hand for no real
// gain: every server action here already validates presence itself and
// returns a proper error if it's missing.

import { useEffect, useId, useRef, useState } from "react";

export interface PortalSelectOption {
  value: string;
  label: string;
}

export interface PortalSelectProps {
  name: string;
  options: PortalSelectOption[];
  defaultValue?: string;
  /** Shown as the first, `value=""` option — e.g. "All companies", "Choose one". */
  placeholder?: string;
  /** Applied to the visible trigger button, so a `<label htmlFor={id}>` still associates correctly. */
  id?: string;
  className?: string;
}

const FALLBACK_BORDER = "#D4D4D4";
const FALLBACK_SURFACE = "#FFFFFF";
const FALLBACK_INK = "#171717";
const FALLBACK_ACTIVE_BG = "#EAF0FF";

export function PortalSelect({
  name,
  options,
  defaultValue = "",
  placeholder,
  id,
  className,
}: PortalSelectProps) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  // A hidden <input> resets its DOM value on a native `form.reset()` (e.g.
  // CreateCompanyForm.tsx's post-success reset) same as any other field,
  // but that's just the DOM — nothing tells the React state driving this
  // component's visible label to follow. Without this, the button would
  // keep showing the last-picked option after a successful submit while
  // the field it actually controls silently went back to defaultValue.
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const onReset = () => setValue(defaultValue);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultValue]);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const allOptions = placeholder ? [{ value: "", label: placeholder }, ...options] : options;
  const selected = allOptions.find((o) => o.value === value) ?? allOptions[0];

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <input type="hidden" name={name} value={value} />

      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-left text-sm outline-none"
        style={{
          borderColor: `var(--admin-border, ${FALLBACK_BORDER})`,
          background: `var(--admin-surface, ${FALLBACK_SURFACE})`,
          color: `var(--admin-ink, ${FALLBACK_INK})`,
        }}
      >
        <span className="truncate">{selected?.label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 opacity-60">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full min-w-max overflow-auto rounded-md border py-1 text-sm shadow-lg"
          style={{
            borderColor: `var(--admin-border, ${FALLBACK_BORDER})`,
            background: `var(--admin-surface, ${FALLBACK_SURFACE})`,
          }}
        >
          {allOptions.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  setValue(opt.value);
                  setOpen(false);
                }}
                className="cursor-pointer px-3 py-1.5 whitespace-nowrap"
                style={{
                  background: isSelected ? `var(--admin-nav-active-bg, ${FALLBACK_ACTIVE_BG})` : "transparent",
                  color: `var(--admin-ink, ${FALLBACK_INK})`,
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default PortalSelect;

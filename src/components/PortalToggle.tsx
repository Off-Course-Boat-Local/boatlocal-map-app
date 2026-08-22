"use client";

// The portal's switch control — the founder's call, replacing the square
// checkbox everywhere a setting is a plain on/off ("I think we should use a
// toggle instead of a checkbox. It looks better.").
//
// Used in two quite different places, which is why it takes `name` rather
// than being split into two components:
//   - inside a <form> (the Add/edit place modal), where it must submit like
//     a checkbox did;
//   - standalone in the Recommendations table, as a controlled quick toggle
//     driven by a Server Action.
//
// FORM SUBMISSION: when `name` is set this renders a hidden input ONLY while
// checked, which reproduces an unchecked checkbox's behaviour exactly —
// absent from the FormData rather than present-and-false. That matters
// because parseRecommendationForm (src/lib/studio/recommendationForm.ts)
// reads visibility as `formData.get("visible") != null`; a hidden input that
// was always present with value "false" would make every place visible.
//
// ACCESSIBILITY: this is a <button role="switch">, not a styled checkbox, so
// it needs aria-checked (screen readers announce "on"/"off") and a real
// label association. Pass `label` for the visible text, or `aria-label` via
// `ariaLabel` when the context supplies the label (e.g. a table row, where
// the row's own name is the label).

import { PORTAL_ACCENT } from "@/components/MapAppMark";

export interface PortalToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Submits like a checkbox of this name when set. Omit for a controlled, form-less toggle. */
  name?: string;
  disabled?: boolean;
  /** Visible text rendered beside the switch. */
  label?: string;
  /** Use when the label lives elsewhere (e.g. a table row's name column). */
  ariaLabel?: string;
  /** Optional helper line under the label. */
  hint?: string;
  size?: "sm" | "md";
  className?: string;
}

export default function PortalToggle({
  checked,
  onChange,
  name,
  disabled = false,
  label,
  ariaLabel,
  hint,
  size = "md",
  className = "",
}: PortalToggleProps) {
  // sm is the in-table size; md is the in-form size.
  const track = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const knob = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const shift = size === "sm" ? "translate-x-4" : "translate-x-5";

  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={checked && !disabled ? { background: PORTAL_ACCENT } : undefined}
      className={`relative inline-flex ${track} shrink-0 items-center rounded-full border-2 border-transparent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20 focus-visible:ring-offset-2 disabled:opacity-50 ${
        checked ? "" : "bg-neutral-200"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block ${knob} transform rounded-full bg-white shadow ring-0 transition-transform ${
          checked ? shift : "translate-x-0"
        }`}
      />
    </button>
  );

  return (
    <span className={`inline-flex items-start gap-3 ${className}`}>
      {/* Only present while checked — see this file's header comment. */}
      {name && checked ? <input type="hidden" name={name} value="on" /> : null}
      {button}
      {label ? (
        <span className="min-w-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className="block text-left text-sm font-medium text-neutral-800 disabled:opacity-50"
          >
            {label}
          </button>
          {hint ? <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span> : null}
        </span>
      ) : null}
    </span>
  );
}

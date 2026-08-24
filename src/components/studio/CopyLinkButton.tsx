"use client";

// Small "copy to clipboard" button shared by every Studio place that shows a
// shareable link (Guides list, company QR, a guide's own Profile page).
// Deliberately separate from the guest app's own copy-link logic in
// GuestWelcomeScreen.tsx's ShareSection — same idea, but that one always
// copies `window.location.href`; this one copies an arbitrary `value` a
// Server Component computed (a guide's link, an invite link, the company
// link), which the current page's own URL never is.

import { useState } from "react";

export interface CopyLinkButtonProps {
  value: string;
  label?: string;
  /** Appended to (not replacing) the default button look — e.g. spacing (`mt-2`), sizing overrides. */
  className?: string;
}

const DEFAULT_CLASS =
  "rounded-lg border border-[var(--studio-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--studio-ink)] transition-colors hover:bg-[var(--studio-bg)]";

export default function CopyLinkButton({ value, label = "Copy link", className }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission/API can be unavailable — the link is still
      // printed on screen next to this button, so it's still copyable by
      // hand.
    }
  };

  return (
    <button type="button" onClick={copy} className={className ? `${DEFAULT_CLASS} ${className}` : DEFAULT_CLASS}>
      {copied ? "Copied!" : label}
    </button>
  );
}

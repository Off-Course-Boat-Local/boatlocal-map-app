"use client";

// Small "copy to clipboard" button shared by every Studio place that shows a
// shareable link (Guides list, company QR, a guide's own Link & QR page).
// Deliberately separate from the guest app's own copy-link logic in
// GuestWelcomeScreen.tsx's ShareSection — same idea, but that one always
// copies `window.location.href`; this one copies an arbitrary `value` a
// Server Component computed (a guide's link, an invite link, the company
// link), which the current page's own URL never is.

import { useState } from "react";

export interface CopyLinkButtonProps {
  value: string;
  label?: string;
  className?: string;
}

const DEFAULT_CLASS =
  "rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50";

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
    <button type="button" onClick={copy} className={className ?? DEFAULT_CLASS}>
      {copied ? "Copied!" : label}
    </button>
  );
}

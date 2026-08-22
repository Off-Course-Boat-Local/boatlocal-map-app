"use client";

// The portal's one modal dialog — shared by Admin and Studio, like
// PortalSelect/PortalToggle/PortalIcons beside it. Admin and Studio are one
// design system (see MapAppMark.tsx's header), so a dialog that appears in
// both must be one component, not two that drift.
//
// EXTRACTED FROM the add/edit-a-place dialog in
// src/components/studio/RecommendationsManager.tsx, which was the first and
// only modal in the app and had grown the right visual shape — centred card,
// dimmed backdrop, title row with a close affordance, scrolls when it
// outgrows the viewport. The founder's call was to create companies the same
// way ("a pop-up, just the same way we create recommendations") rather than
// with a form permanently occupying the top of the page, and for a
// "Create company" button anywhere in the app to open that same dialog. That
// only works if the dialog is a component any page can mount, which is this.
//
// WHAT IT ADDS over the markup it replaces, none of which that inline
// version had — a dialog that traps nobody and announces nothing is a dialog
// only a mouse user can operate:
//   - Escape closes it.
//   - The page behind does not scroll while it is open.
//   - Clicking the backdrop closes it; clicking inside never does.
//   - role="dialog" + aria-modal + aria-labelledby pointing at the title.
//   - Focus moves into the dialog on open and returns to whatever was
//     focused before when it closes, so a keyboard user is not dumped back
//     at the top of the document.
//   - Tab cycles within the dialog instead of walking the page behind it.
//
// DELIBERATELY NOT <dialog>/showModal(): its ::backdrop cannot be styled
// with the same tokens as the rest of the portal without a second styling
// path, and Safari only shipped full support relatively recently. The
// behaviours above are the parts of <dialog> that matter and are ~40 lines.

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";

export interface PortalModalProps {
  open: boolean;
  onClose: () => void;
  /** Shown in the header row and announced as the dialog's accessible name. */
  title: string;
  children: ReactNode;
  /** Tailwind max-width class for the card. Defaults to a form-sized dialog. */
  maxWidthClassName?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function PortalModal({
  open,
  onClose,
  title,
  children,
  maxWidthClassName = "max-w-lg",
}: PortalModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const card = cardRef.current;
      if (!card) return;

      const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusable.length === 0) {
        // Nothing focusable inside: keep focus on the card rather than
        // letting Tab escape to the page behind.
        event.preventDefault();
        card.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === card)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown, true);

    // Focus the first control in the BODY, not the card's own close button —
    // which is first in DOM order, so a naive query lands there and makes
    // Enter dismiss the dialog the instant it opens. Falls back to the card
    // when the body has nothing focusable (a confirm-style dialog).
    const card = cardRef.current;
    const firstField = bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (firstField ?? card)?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10 sm:pt-16"
      // A backdrop click closes; a click that started inside the card and
      // ended on the backdrop (a drag while selecting text) must not, which
      // is why this checks the target rather than just listening on the
      // backdrop.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${maxWidthClassName} rounded-2xl bg-white p-6 shadow-xl outline-none`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-neutral-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-1 shrink-0 rounded p-1 text-neutral-400 transition-colors hover:text-neutral-700"
          >
            &times;
          </button>
        </div>
        <div ref={bodyRef}>{children}</div>
      </div>
    </div>
  );
}

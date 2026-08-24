"use client";

// The company's own "Publish / Unpublish" control — the founder's call to
// move initial visibility off Admin's onboarding form and onto the company
// itself: a brand-new company always starts hidden ("setup"), and now
// publishes itself once it's actually ready, from its own Dashboard.
// Unpublishing takes every one of the company's guides down with it too
// (guest_public_read / getActiveCompanyRecord already gate on the
// company's own status — nothing guide-side needed changing for that).

import { useState, useTransition } from "react";

import PortalToggle from "@/components/PortalToggle";
import { setCompanyPublishedAction } from "@/lib/studio/publishActions";
import type { CompanyStatus } from "@/lib/data/types";
import { CARD_SHADOW } from "./primitives";

export interface CompanyPublishToggleProps {
  companyId: string;
  status: CompanyStatus;
}

export default function CompanyPublishToggle({ companyId, status }: CompanyPublishToggleProps) {
  const [current, setCurrent] = useState<CompanyStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (current === "suspended") {
    return (
      <div className={`rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900 ${CARD_SHADOW}`}>
        This company has been suspended by Boat Local staff — your guest link is offline until
        they reactivate it. Contact support if you believe this is a mistake.
      </div>
    );
  }

  const published = current === "active";

  return (
    <div
      className={`rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] px-5 py-4 ${CARD_SHADOW}`}
    >
      <PortalToggle
        checked={published}
        disabled={isPending}
        onChange={(next) => {
          setError(null);
          const previous = current;
          setCurrent(next ? "active" : "setup");
          startTransition(async () => {
            try {
              await setCompanyPublishedAction(companyId, next);
            } catch (err) {
              setCurrent(previous);
              setError(err instanceof Error ? err.message : "Could not update your publish status.");
            }
          });
        }}
        label={published ? "Live — guests can see you" : "Unpublished — hidden from guests"}
        hint={
          published
            ? "Turn this off any time to pull your guest link (and every guide under it) offline."
            : "Turn this on once you're happy with your branding, guides, and recommendations."
        }
      />
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

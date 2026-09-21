"use client";

import { useState, useTransition } from "react";
import PortalToggle from "@/components/PortalToggle";
import type { CompanyModules } from "@/lib/types";
import { updateCompanyModulesAction } from "@/lib/studio/settingsActions";
import { CARD_SHADOW, Eyebrow, GhostButton, PageHeader, SectionHeading } from "./primitives";
import { logoutAction } from "@/lib/studio/actions";

export interface CompanySettingsManagerProps {
  companyId: string;
  companyName: string;
  appName: string;
  ownerEmail: string;
  initialModules: CompanyModules;
}

export default function CompanySettingsManager({
  companyId,
  companyName,
  appName,
  ownerEmail,
  initialModules,
}: CompanySettingsManagerProps) {
  const [modules, setModules] = useState<CompanyModules>(initialModules);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleToggle(key: keyof CompanyModules, value: boolean) {
    const updated = { ...modules, [key]: value };
    setModules(updated);
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await updateCompanyModulesAction(companyId, updated);
      if (res.error) {
        setError(res.error);
        setModules(modules); // rollback
      } else {
        setSuccess("Module settings updated.");
        setTimeout(() => setSuccess(null), 3000);
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your company settings and feature modules."
      />

      {/* Feature Modules */}
      <section className="space-y-4">
        <SectionHeading
          title="Feature Modules"
          description="Enable or disable capabilities for your company's map and Studio workspace."
        />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
            {success}
          </div>
        )}

        <div className={`divide-y divide-[var(--studio-border)] rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] ${CARD_SHADOW}`}>
          {/* Routes Module */}
          <div className="flex items-center justify-between p-5">
            <div className="pr-4">
              <p className="text-sm font-semibold text-[var(--studio-ink)]">Custom Routes</p>
              <p className="mt-1 text-xs text-[var(--studio-ink-soft)]">
                Create and share curated cycling, walking, or boating itineraries with waypoints, distances, and duration estimates.
              </p>
            </div>
            <PortalToggle
              checked={modules.routes ?? true}
              onChange={(checked) => handleToggle("routes", checked)}
              disabled={isPending}
              label="Enable custom routes"
            />
          </div>

          {/* Events Module */}
          <div className="flex items-center justify-between p-5">
            <div className="pr-4">
              <p className="text-sm font-semibold text-[var(--studio-ink)]">Company Events</p>
              <p className="mt-1 text-xs text-[var(--studio-ink-soft)]">
                Post time-sensitive events, meetups, or live entertainment with Google Maps locations, dates, and ticket/RSVP links.
              </p>
            </div>
            <PortalToggle
              checked={modules.events ?? true}
              onChange={(checked) => handleToggle("events", checked)}
              disabled={isPending}
              label="Enable company events"
            />
          </div>

          {/* Custom Tours Module */}
          <div className="flex items-center justify-between p-5">
            <div className="pr-4">
              <p className="text-sm font-semibold text-[var(--studio-ink)]">Custom & Multi-modal Tours</p>
              <p className="mt-1 text-xs text-[var(--studio-ink-soft)]">
                Add your own boat tours, bike tours, walking tours, and food tours with custom booking URLs and prices.
              </p>
            </div>
            <PortalToggle
              checked={modules.custom_tours ?? true}
              onChange={(checked) => handleToggle("custom_tours", checked)}
              disabled={isPending}
              label="Enable custom tours"
            />
          </div>
        </div>
      </section>

      {/* Account Info */}
      <section className="space-y-4">
        <SectionHeading
          title="Account Details"
          description="Your company identification in Map App Studio."
        />

        <div className={`overflow-hidden rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] ${CARD_SHADOW}`}>
          <div className="border-b border-[var(--studio-border)] px-5 py-3.5">
            <Eyebrow>Signed in as</Eyebrow>
            <p className="mt-1 text-sm text-[var(--studio-ink)]">{ownerEmail}</p>
          </div>
          <div className="border-b border-[var(--studio-border)] px-5 py-3.5">
            <Eyebrow>Company Name</Eyebrow>
            <p className="mt-1 text-sm text-[var(--studio-ink)]">{companyName}</p>
          </div>
          <div className="px-5 py-3.5">
            <Eyebrow>App Name</Eyebrow>
            <p className="mt-1 text-sm text-[var(--studio-ink)]">{appName}</p>
          </div>
        </div>
      </section>

      {/* Sign out */}
      <div className={`rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 ${CARD_SHADOW}`}>
        <p className="text-sm font-semibold text-[var(--studio-ink)]">Sign out</p>
        <p className="mt-1 text-xs text-[var(--studio-ink-soft)]">
          Ends this session on this device. You can sign back in any time with a new link.
        </p>
        <form action={logoutAction} className="mt-3">
          <GhostButton size="sm" type="submit">
            Sign out
          </GhostButton>
        </form>
      </div>
    </div>
  );
}

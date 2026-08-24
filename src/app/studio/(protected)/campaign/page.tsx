// Campaign — company only (PRD §7.6). One tracking link, pasted once, that
// auto-propagates to every boat tour's booking button.

import CampaignForm from "@/components/studio/CampaignForm";
import { CARD_SHADOW, PageHeader } from "@/components/studio/primitives";
import { getCompanyForStudio } from "@/lib/data/source";
import { actorFromSession, requireCompanyRole, requireDevSession } from "@/lib/studio/devAuth";

export default async function StudioCampaignPage() {
  const session = await requireDevSession();
  requireCompanyRole(session);
  const actor = actorFromSession(session);

  const company = await getCompanyForStudio(actor, session.companyId);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Campaign"
        description="One tracking link for this tenant, reused on every boat tour's booking button."
      />

      <div className={`rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 ${CARD_SHADOW}`}>
        <CampaignForm companyId={session.companyId} savedValue={company?.campaignParams ?? ""} />
      </div>

      <div className="rounded-2xl border border-dashed border-[var(--studio-border)] p-5 text-sm text-[var(--studio-ink-soft)]">
        <p className="font-medium text-[var(--studio-ink)]">How this reaches a booking link</p>
        <p className="mt-1">
          Saving here updates this company&rsquo;s{" "}
          <code className="rounded bg-[var(--studio-bg)] px-1 py-0.5">campaignParams</code> via{" "}
          <code className="rounded bg-[var(--studio-bg)] px-1 py-0.5">updateCompanyBranding</code>{" "}
          (src/lib/data/source.ts). The merge itself happens in{" "}
          <code className="rounded bg-[var(--studio-bg)] px-1 py-0.5">buildBoatBookingHandoff</code>{" "}
          (src/lib/boatBookingHandoff.ts), which now accepts an optional{" "}
          <code className="rounded bg-[var(--studio-bg)] px-1 py-0.5">campaignParams</code> and folds it
          onto the booking URL without ever overwriting the click-id/date/guest params
          attribution.ts already sets.
        </p>
        <p className="mt-2">
          <span className="font-medium text-[var(--studio-ink)]">Integration point still open:</span> the
          guest map/list/saved screens (
          <code className="rounded bg-[var(--studio-bg)] px-1 py-0.5">
            src/components/guest/Guest*Screen.tsx
          </code>
          ) call{" "}
          <code className="rounded bg-[var(--studio-bg)] px-1 py-0.5">guestPinAction</code> today
          without a campaignParams option, since they only fetch the lightweight{" "}
          <code className="rounded bg-[var(--studio-bg)] px-1 py-0.5">Brand</code> shape, not the full{" "}
          <code className="rounded bg-[var(--studio-bg)] px-1 py-0.5">CompanyRecord</code> that carries
          this value. Threading{" "}
          <code className="rounded bg-[var(--studio-bg)] px-1 py-0.5">companyRecord.campaignParams</code>{" "}
          through there is the entire remaining wire-up — the option already exists and is a
          no-op until then.
        </p>
      </div>
    </div>
  );
}

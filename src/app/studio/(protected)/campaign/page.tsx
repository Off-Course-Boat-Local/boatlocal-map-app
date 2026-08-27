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
        description="One tracking link for this company, applied automatically to every boat tour's booking button."
      />

      <div className={`rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 ${CARD_SHADOW}`}>
        <CampaignForm companyId={session.companyId} savedValue={company?.campaignParams ?? ""} />
      </div>
    </div>
  );
}

// Guides — company only (PRD §7.3): invite a guide (generates a real,
// unique-token-bearing link even though there is no backend to redeem it
// against yet), list guides with status + performance, deactivate/
// reactivate, and QR codes — one per guide plus a company-level one for the
// bare subdomain root (no guide path/param), for shared/lobby placement.

import GuidesTable, { type GuideRowData } from "@/components/studio/GuidesTable";
import InviteGuideForm from "@/components/studio/InviteGuideForm";
import ShareQr from "@/components/ShareQr";
import CopyLinkButton from "@/components/studio/CopyLinkButton";
import { getCompanyAnalyticsSummary, getCompanyForStudio, getGuidesForCompany } from "@/lib/data/source";
import { actorFromSession, requireCompanyRole, requireDevSession } from "@/lib/studio/devAuth";
import { currentOrigin } from "@/lib/studio/requestOrigin";
import { buildCompanyShareUrl, buildGuideShareUrl, buildInviteUrl } from "@/lib/studio/shareLinks";

export default async function StudioGuidesPage() {
  const session = await requireDevSession();
  requireCompanyRole(session);
  const actor = actorFromSession(session);

  const [company, guides, analytics, origin] = await Promise.all([
    getCompanyForStudio(actor, session.companyId),
    getGuidesForCompany(actor, session.companyId),
    getCompanyAnalyticsSummary(actor, session.companyId),
    currentOrigin(),
  ]);

  // Per-guide performance (PRD §7.3 "status & performance"): tips saved and
  // book clicks are the two counters PRD §6.4 already names for the guide's
  // own dashboard, so the company sees the same two per guide here.
  const statsByGuide = new Map<string, { tipsSaved: number; bookClicks: number }>();
  for (const row of analytics) {
    if (!row.guideId) continue;
    const entry = statsByGuide.get(row.guideId) ?? { tipsSaved: 0, bookClicks: 0 };
    if (row.eventType === "tip_saved") entry.tipsSaved += row.count;
    if (row.eventType === "boat_book_click") entry.bookClicks += row.count;
    statsByGuide.set(row.guideId, entry);
  }

  const rows: GuideRowData[] = guides.map((guide) => ({
    id: guide.id,
    name: guide.name,
    email: guide.email,
    slug: guide.slug,
    status: guide.status,
    shareUrl: company
      ? buildGuideShareUrl({ origin, subdomain: company.subdomain, guideSlug: guide.slug })
      : "",
    inviteUrl:
      guide.status === "invited" && guide.inviteToken
        ? buildInviteUrl({ origin, token: guide.inviteToken })
        : null,
    tipsSaved: statsByGuide.get(guide.id)?.tipsSaved ?? 0,
    bookClicks: statsByGuide.get(guide.id)?.bookClicks ?? 0,
  }));

  const companyShareUrl = company ? buildCompanyShareUrl({ origin, subdomain: company.subdomain }) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Guides</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Invite guides, keep an eye on their numbers, and hand out a QR for
          each one — or the shared company QR below for a lobby or reception
          desk where no single guide applies.
        </p>
      </div>

      <InviteGuideForm />

      {companyShareUrl ? (
        <div className="flex flex-wrap items-start gap-4 rounded-xl border border-neutral-200 bg-white p-4">
          <ShareQr value={companyShareUrl} size={112} downloadFileName={`${company?.subdomain}-company-qr`} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Company QR (no guide)
            </p>
            <p className="mt-1 break-all font-mono text-xs text-neutral-600">{companyShareUrl}</p>
            <CopyLinkButton value={companyShareUrl} className="mt-2 rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50" />
          </div>
        </div>
      ) : null}

      <GuidesTable guides={rows} />
    </div>
  );
}

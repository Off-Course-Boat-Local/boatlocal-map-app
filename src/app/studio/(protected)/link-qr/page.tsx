// Profile, Link & QR / Stats — guide only (PRD §6.2 + §6.4's "Link & QR /
// Stats" tab, combined into one page like the existing nav item already
// does). The company-role equivalent of Report, scoped to just this guide's
// own numbers, plus their own editable profile and shareable link.

import CopyLinkButton from "@/components/studio/CopyLinkButton";
import GuideProfileForm from "@/components/studio/GuideProfileForm";
import ShareQr from "@/components/ShareQr";
import { getCompanyForStudio, getGuideAnalyticsSummary, getGuidesForCompany } from "@/lib/data/source";
import { actorFromSession, requireDevSession, requireGuideRole } from "@/lib/studio/devAuth";
import { currentOrigin } from "@/lib/studio/requestOrigin";
import { buildGuideShareUrl } from "@/lib/studio/shareLinks";

export default async function StudioLinkQrPage() {
  const session = await requireDevSession();
  requireGuideRole(session);
  const actor = actorFromSession(session);

  const [company, guides, analytics, origin] = await Promise.all([
    getCompanyForStudio(actor, session.companyId),
    getGuidesForCompany(actor, session.companyId),
    getGuideAnalyticsSummary(actor, session.guideId),
    currentOrigin(),
  ]);

  const guide = guides.find((g) => g.id === session.guideId);
  const total = analytics.reduce((sum, row) => sum + row.count, 0);

  // Real and live today — see src/lib/studio/shareLinks.ts's header comment
  // for why this is the query-param form rather than the eventual
  // `{company}.map.boatlocal.nl/{slug}` subdomain (PRD §13.1), and why that
  // makes it MORE current than a hardcoded illustrative string, not less.
  const guideLink =
    company && guide ? buildGuideShareUrl({ origin, subdomain: company.subdomain, guideSlug: guide.slug }) : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Profile, Link &amp; QR / Stats</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Your photo, your welcome message, your own share link, and how it&rsquo;s
          performing.
        </p>
      </div>

      {guide ? (
        <GuideProfileForm
          initialWelcomeMessage={guide.welcomeMessage}
          initialAvatarUrl={guide.avatarUrl}
          avatarInitial={guide.avatarInitial}
        />
      ) : null}

      {guideLink ? (
        <div className="flex flex-wrap items-start gap-6 rounded-xl border border-neutral-200 bg-white p-4">
          <ShareQr value={guideLink} size={140} downloadFileName={`${guide?.slug ?? "guide"}-qr`} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Your link
            </p>
            <p className="mt-1 break-all font-mono text-sm text-neutral-900">{guideLink}</p>
            <CopyLinkButton
              value={guideLink}
              label="Copy link"
              className="mt-3 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            />
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Event</th>
              <th className="px-4 py-2 font-medium">Count</th>
            </tr>
          </thead>
          <tbody>
            {analytics.map((row) => (
              <tr key={row.eventType} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2 text-neutral-900">{row.eventType}</td>
                <td className="px-4 py-2 text-neutral-600">{row.count}</td>
              </tr>
            ))}
            {analytics.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-neutral-500" colSpan={2}>
                  No events recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <p className="border-t border-neutral-200 px-4 py-2 text-xs text-neutral-500">
          {total} event{total === 1 ? "" : "s"} total.
        </p>
      </div>
    </div>
  );
}

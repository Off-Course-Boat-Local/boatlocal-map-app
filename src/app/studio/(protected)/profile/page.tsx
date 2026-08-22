// Profile — guide only. Everything about how this guide shows up to a guest
// and how a guest reaches them: photo, welcome message, share link, QR.
//
// Split out of the old combined "/studio/link-qr" page ("Profile, Link & QR
// / Stats"), which mixed three unrelated jobs on one screen. The stats half
// moved to the Dashboard; the account half is /studio/settings. The share
// link and QR stayed HERE rather than in Settings on purpose: they aren't a
// setting a guide configures, they're the outward-facing identity this page
// is about — the thing they hand to a guest, print, or put on a card.

import CopyLinkButton from "@/components/studio/CopyLinkButton";
import GuideProfileForm from "@/components/studio/GuideProfileForm";
import ShareQr from "@/components/ShareQr";
import { getCompanyForStudio, getGuidesForCompany } from "@/lib/data/source";
import { actorFromSession, requireDevSession, requireGuideRole } from "@/lib/studio/devAuth";
import { currentOrigin } from "@/lib/studio/requestOrigin";
import { buildGuideShareUrl } from "@/lib/studio/shareLinks";

export const metadata = {
  title: "Profile — Map App Studio",
};

export default async function StudioProfilePage() {
  const session = await requireDevSession();
  requireGuideRole(session);
  const actor = actorFromSession(session);

  const [company, guides, origin] = await Promise.all([
    getCompanyForStudio(actor, session.companyId),
    getGuidesForCompany(actor, session.companyId),
    currentOrigin(),
  ]);

  const guide = guides.find((g) => g.id === session.guideId);

  // Real and live today — see src/lib/studio/shareLinks.ts's header comment
  // for why this is the query-param form rather than the eventual
  // `{company}.map.boatlocal.nl/{slug}` subdomain (PRD §13.1).
  const guideLink =
    company && guide
      ? buildGuideShareUrl({ origin, subdomain: company.subdomain, guideSlug: guide.slug })
      : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Profile</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Your photo and welcome message, and the link guests use to open your map.
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
            <p className="mt-2 text-xs text-neutral-500">
              Every guest who opens this is counted as yours — see the Dashboard
              for how it&rsquo;s performing.
            </p>
            <CopyLinkButton
              value={guideLink}
              label="Copy link"
              className="mt-3 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

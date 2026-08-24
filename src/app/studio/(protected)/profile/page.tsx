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
import { CARD_SHADOW, Eyebrow, PageHeader } from "@/components/studio/primitives";
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
  // for why the query-param form is the real, permanent mechanism now, not
  // a stand-in for subdomain routing that isn't coming.
  const guideLink =
    company && guide
      ? buildGuideShareUrl({ origin, companyId: company.id, guideSlug: guide.slug })
      : null;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Profile"
        description="Your photo and welcome message, and the link guests use to open your map."
      />

      {guide ? (
        <GuideProfileForm
          initialWelcomeMessage={guide.welcomeMessage}
          initialAvatarUrl={guide.avatarUrl}
          avatarInitial={guide.avatarInitial}
        />
      ) : null}

      {guideLink ? (
        <div
          className={`flex flex-wrap items-start gap-6 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 ${CARD_SHADOW}`}
        >
          <ShareQr value={guideLink} size={140} downloadFileName={`${guide?.slug ?? "guide"}-qr`} />
          <div className="min-w-0 flex-1">
            <Eyebrow>Your link</Eyebrow>
            <p className="mt-1 font-mono text-sm break-all text-[var(--studio-ink)]">{guideLink}</p>
            <p className="mt-2 text-xs text-[var(--studio-ink-soft)]">
              Every guest who opens this is counted as yours — see the Dashboard
              for how it&rsquo;s performing.
            </p>
            <CopyLinkButton value={guideLink} label="Copy link" className="mt-3" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

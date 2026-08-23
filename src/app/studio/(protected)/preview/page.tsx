// Preview — the guest app, on its own page, for BOTH roles.
//
// Previously the preview was chrome rather than a destination: a permanently
// docked 460px panel for companies and a slide-over drawer for guides. Both
// showed a static rendering you could look at but not use. The founder's
// call was to make it a real page you can click through — so this route
// loads the live guest app in an iframe (see GuestPreviewFrame.tsx) and the
// sidebar links to it from the foot, next to Log out, rather than the
// preview occupying width on every screen.
//
// NOTHING DONE HERE IS COUNTED. The URLs carry `?preview=1`, which
// src/proxy.ts converts into a request header + session cookie that
// src/lib/guestEvents.ts checks before every analytics write — so opening
// the app, tapping a tip, and hitting "Book this tour" in here record no
// app_open, no tip_viewed, no boat_book_click. See src/lib/guestPreview.ts
// for why that check lives at the write path rather than at each screen.
//
// Role difference is only WHAT can be previewed, not whether: a guide sees
// their own link, because that is the only guest view they own. A company
// admin can switch between the company-level link and any of its guides'
// links, because all of them are the company's own guest app — consistent
// with the company seeing everything across the tenant while a guide is
// scoped to themselves.

import GuestPreviewFrame, { type PreviewTarget } from "@/components/studio/GuestPreviewFrame";
import { getCompanyForStudio, getGuidesForCompany } from "@/lib/data/source";
import { actorFromSession, requireDevSession } from "@/lib/studio/devAuth";
import { currentOrigin } from "@/lib/studio/requestOrigin";
import { buildGuestPreviewUrl } from "@/lib/studio/shareLinks";

export const metadata = {
  title: "Preview — Map App Studio",
};

export default async function StudioPreviewPage() {
  const session = await requireDevSession();
  const actor = actorFromSession(session);

  const [company, guides, origin] = await Promise.all([
    getCompanyForStudio(actor, session.companyId),
    getGuidesForCompany(actor, session.companyId),
    currentOrigin(),
  ]);

  const targets: PreviewTarget[] = [];

  if (company) {
    if (session.role === "guide") {
      const guide = guides.find((g) => g.id === session.guideId);
      if (guide) {
        targets.push({
          value: guide.id,
          label: `Your link — ${guide.name}`,
          url: buildGuestPreviewUrl({
            origin,
            companyId: company.id,
            guideSlug: guide.slug,
          }),
        });
      }
    } else {
      targets.push({
        value: "company",
        label: "Company link (no guide)",
        url: buildGuestPreviewUrl({ origin, companyId: company.id }),
      });
      for (const guide of guides) {
        if (guide.status !== "active") continue;
        targets.push({
          value: guide.id,
          label: `${guide.name}'s link`,
          url: buildGuestPreviewUrl({
            origin,
            companyId: company.id,
            guideSlug: guide.slug,
          }),
        });
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Preview</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          The real guest app, exactly as someone opening your link sees it.
          Click through it as much as you like — nothing in here is counted as
          a visit, a tap or a booking click, and none of it reaches your
          statistics.
        </p>
      </div>

      <GuestPreviewFrame targets={targets} />
    </div>
  );
}

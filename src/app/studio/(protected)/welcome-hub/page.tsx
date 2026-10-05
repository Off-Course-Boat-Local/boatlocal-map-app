// Welcome Hub — company only: the block-based Home content guests see at "/".
// Edits the company default, or a specific guide's own hub (?guide=<id>).

import WelcomeHubEditor from "@/components/studio/WelcomeHubEditor";
import { PageHeader } from "@/components/studio/primitives";
import { getGuidesForCompany, getMapPins } from "@/lib/data/source";
import { getFallbackWelcomeBlocks, getWelcomeHub } from "@/lib/data/welcomeHub";
import { actorFromSession, requireCompanyRole, requireDevSession } from "@/lib/studio/devAuth";

export const metadata = {
  title: "Welcome Hub — Map App Studio",
};

export default async function StudioWelcomeHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireDevSession();
  requireCompanyRole(session);
  const actor = actorFromSession(session);

  const [guides, pins, params] = await Promise.all([
    getGuidesForCompany(actor, session.companyId),
    getMapPins(session.companyId),
    searchParams,
  ]);

  // Ignore an unknown ?guide= rather than editing a hub that isn't this company's.
  const requested = typeof params.guide === "string" ? params.guide : null;
  const guideId = requested && guides.some((g) => g.id === requested) ? requested : null;

  const own = await getWelcomeHub(session.companyId, guideId, { exact: true });
  // A guide without their own hub starts from the company default; the company
  // default itself starts from the standard blocks until first saved.
  const base = own ?? (guideId ? await getWelcomeHub(session.companyId, null, { exact: true }) : null);
  const blocks = base?.blocks?.length ? base.blocks : getFallbackWelcomeBlocks();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Welcome Hub"
        description="The blocks guests see on the Home tab after a tour: your thank-you, review links, shortcuts, tips and featured places. Set a company default, or give a guide their own."
      />
      <WelcomeHubEditor
        key={guideId ?? "company"}
        guideId={guideId}
        guides={guides.map((g) => ({ id: g.id, name: g.name }))}
        places={pins.filter((p) => !p.isBoat).map((p) => ({ id: p.id, name: p.name }))}
        initialBlocks={blocks}
        hasOwnHub={!!own}
      />
    </div>
  );
}

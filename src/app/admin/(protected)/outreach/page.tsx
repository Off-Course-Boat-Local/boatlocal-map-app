// Admin Outreach — the affiliate-prospecting list. Cold leads found via
// research (seeded from scripts/import-outreach-prospects.mjs), tracked
// separately from live tenants in Companies (see the migration's own
// comment for why). Sorted so whatever needs attention floats to the top —
// see listOutreachProspects' own ordering comment.

import type { Metadata } from "next";

import { ADMIN_ACTOR } from "@/lib/admin/actor";
import { listOutreachProspects } from "@/lib/data/outreach";
import OutreachImportButton from "@/components/admin/OutreachImportButton";
import OutreachProspectsTable from "@/components/admin/OutreachProspectsTable";
import { PageHeader } from "@/components/admin/primitives";

export const metadata: Metadata = { title: "Outreach" };

/** How long a prospect the research routine (docs/outreach-research.md) added still gets the "New" mark. */
const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export default async function AdminOutreachPage() {
  const prospects = await listOutreachProspects(ADMIN_ACTOR);
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div>
      <PageHeader
        title="Outreach"
        description="Cold-prospecting tracker for bike, walking, and food tour operators — separate from Companies until one is actually onboarded."
        hint={`${prospects.length} prospect${prospects.length === 1 ? "" : "s"} · ${
          prospects.filter((p) => p.nextActionDueAt && new Date(p.nextActionDueAt).getTime() <= now).length
        } follow-up(s) overdue · ${
          prospects.filter((p) => p.source === "agent" && now - new Date(p.createdAt).getTime() <= NEW_WINDOW_MS)
            .length
        } new this week`}
        action={<OutreachImportButton />}
      />

      <OutreachProspectsTable prospects={prospects} />
    </div>
  );
}

import type { Metadata } from "next";

import { ADMIN_ACTOR } from "@/lib/admin/actor";
import { guidePerformance } from "@/lib/admin/analytics";
import { getGuidesForCompany, listCompanies } from "@/lib/data/source";
import AdminTable from "@/components/admin/AdminTable";
import AdminGuideRowActions from "@/components/admin/AdminGuideRowActions";
import { PageHeader } from "@/components/admin/primitives";
import StatusBadge from "@/components/admin/StatusBadge";
import { currentOrigin } from "@/lib/studio/requestOrigin";

export const metadata: Metadata = { title: "Guides" };

export default async function AdminGuidesPage() {
  const origin = await currentOrigin();
  const companies = await listCompanies(ADMIN_ACTOR);
  const guidesByCompany = await Promise.all(
    companies.map(async (company) => ({
      company,
      guides: await getGuidesForCompany(ADMIN_ACTOR, company.id),
    })),
  );

  const totalGuides = guidesByCompany.reduce((sum, g) => sum + g.guides.length, 0);

  // Every guide across every company (PRD §8.3), platform-wide — the
  // per-company equivalent lives in Studio > Guides
  // (src/app/studio/guides/page.tsx), scoped to just that company's own.
  const rows = await Promise.all(
    guidesByCompany.flatMap(({ company, guides }) =>
      guides.map(async (guide) => {
        // Real aggregation over `events` (src/lib/admin/analytics.ts).
        const performance = await guidePerformance(guide.id);
        return [
          <span key="name" className="font-medium whitespace-nowrap">
            {guide.name}
          </span>,
          <span key="email" className="text-xs text-[var(--admin-ink)]">{guide.email}</span>,
          <span key="slug" className="font-mono text-xs text-[var(--admin-ink-soft)]">{guide.slug}</span>,
          <span key="company" className="text-xs font-medium">{company.name}</span>,
          <StatusBadge
            key="status"
            status={guide.status}
            tone={guide.status === "active" ? "positive" : "neutral"}
          />,
          String(performance.appOpens),
          String(performance.tipsSaved),
          String(performance.bookClicks),
          <AdminGuideRowActions
            key="actions"
            guideId={guide.id}
            guideName={guide.name}
            guideSlug={guide.slug}
            companyId={company.id}
            status={guide.status}
            origin={origin}
          />,
        ];
      }),
    ),
  );

  return (
    <div>
      <PageHeader
        title="Guides"
        description={`${totalGuides} guide${totalGuides === 1 ? "" : "s"} across ${companies.length} compan${companies.length === 1 ? "y" : "ies"}.`}
        hint="App opens, tips saved and book clicks are live counts from events, over the last 30 days."
      />

      <AdminTable
        columns={[
          "Guide",
          "Email",
          "Slug",
          "Company",
          "Status",
          "App opens",
          "Tips saved",
          "Book clicks",
          "Actions",
        ]}
        rows={rows}
        emptyMessage="No guides yet."
      />
    </div>
  );
}

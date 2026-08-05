import type { Metadata } from "next";

import { ADMIN_ACTOR } from "@/lib/admin/actor";
import { mockGuidePerformance } from "@/lib/admin/mockAnalytics";
import { getGuidesForCompany, listCompanies } from "@/lib/data/source";
import AdminTable from "@/components/admin/AdminTable";
import StatusBadge from "@/components/admin/StatusBadge";

export const metadata: Metadata = { title: "Guides" };

export default async function AdminGuidesPage() {
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
  const rows = guidesByCompany.flatMap(({ company, guides }) =>
    guides.map((guide) => {
      // Placeholder performance numbers — see src/lib/admin/mockAnalytics.ts
      // for why (the fake store seeds zero events, so real figures would
      // all read 0 today).
      const performance = mockGuidePerformance(guide.id);
      return [
        guide.name,
        guide.email,
        guide.slug,
        company.name,
        <StatusBadge
          key="status"
          status={guide.status}
          tone={guide.status === "active" ? "positive" : "neutral"}
        />,
        String(performance.appOpens),
        String(performance.tipsSaved),
        String(performance.bookClicks),
      ];
    }),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Guides</h1>
      <p className="mt-1 text-sm text-[var(--admin-ink-soft)]">
        {totalGuides} guide{totalGuides === 1 ? "" : "s"} across {companies.length}{" "}
        compan{companies.length === 1 ? "y" : "ies"}.
      </p>
      <p className="mt-1 text-xs text-[var(--admin-ink-soft)]">
        App opens, tips saved and book clicks are placeholder numbers until real event volume
        exists — see the comment on <code>mockGuidePerformance</code> in
        src/lib/admin/mockAnalytics.ts.
      </p>

      <AdminTable
        className="mt-6"
        columns={[
          "Guide",
          "Email",
          "Slug",
          "Company",
          "Status",
          "App opens",
          "Tips saved",
          "Book clicks",
        ]}
        rows={rows}
        emptyMessage="No guides yet."
      />
    </div>
  );
}

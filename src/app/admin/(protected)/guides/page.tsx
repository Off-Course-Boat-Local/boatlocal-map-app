import type { Metadata } from "next";

import { ADMIN_ACTOR } from "@/lib/admin/actor";
import { guidePerformance } from "@/lib/admin/analytics";
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
  const rows = await Promise.all(
    guidesByCompany.flatMap(({ company, guides }) =>
      guides.map(async (guide) => {
      // Real aggregation over `events` (src/lib/admin/analytics.ts).
      const performance = await guidePerformance(guide.id);
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
    ),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Guides</h1>
      <p className="mt-1 text-sm text-[var(--admin-ink-soft)]">
        {totalGuides} guide{totalGuides === 1 ? "" : "s"} across {companies.length}{" "}
        compan{companies.length === 1 ? "y" : "ies"}.
      </p>
      <p className="mt-1 text-xs text-[var(--admin-ink-soft)]">
        App opens, tips saved and book clicks are live counts from <code>events</code>, over the
        last 30 days.
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

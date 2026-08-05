// Admin Companies (PRD §8.3): view/manage every tenant, per-company
// performance, and the full onboarding flow (create a company, assign a
// subdomain slug, set its type, set an initial setup/live status). Writes
// go through src/lib/admin/companyActions.ts -> createCompany /
// setCompanyStatus in src/lib/data/source.ts, admin-only and enforced
// there the same way RLS will enforce it once a real database exists.

import type { Metadata } from "next";

import { ADMIN_ACTOR } from "@/lib/admin/actor";
import { setCompanyStatusAction } from "@/lib/admin/companyActions";
import { mockCompanyPerformance } from "@/lib/admin/mockAnalytics";
import { getGuidesForCompany, listCompanies } from "@/lib/data/source";
import type { CompanyStatus } from "@/lib/data/types";
import AdminTable from "@/components/admin/AdminTable";
import CreateCompanyForm from "@/components/admin/CreateCompanyForm";
import StatusBadge from "@/components/admin/StatusBadge";

export const metadata: Metadata = { title: "Companies" };

const COMPANY_TYPE_LABELS: Record<string, string> = {
  hotel: "Hotel",
  tour: "Tour operator",
  host: "Host",
};

const STATUS_TONE: Record<CompanyStatus, "positive" | "neutral" | "warning"> = {
  setup: "neutral",
  active: "positive",
  suspended: "warning",
};

const STATUS_LABEL: Record<CompanyStatus, string> = {
  setup: "Setup",
  active: "Live",
  suspended: "Suspended",
};

function statusActionButtonClass(): string {
  return "rounded-md border border-[var(--admin-border)] px-2 py-1 text-xs font-medium text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]";
}

/** The one or two next-status actions available from a company's current status. */
function nextStatusActions(status: CompanyStatus): { label: string; next: CompanyStatus }[] {
  switch (status) {
    case "setup":
      return [{ label: "Go live", next: "active" }];
    case "active":
      return [{ label: "Suspend", next: "suspended" }];
    case "suspended":
      return [{ label: "Reactivate", next: "active" }];
  }
}

export default async function AdminCompaniesPage() {
  const companies = await listCompanies(ADMIN_ACTOR);

  const rows = await Promise.all(
    companies.map(async (company) => {
      const guides = await getGuidesForCompany(ADMIN_ACTOR, company.id);
      // Placeholder performance numbers — see the comment on
      // mockCompanyPerformance in src/lib/admin/mockAnalytics.ts (the fake
      // store seeds zero events, so a real aggregation would read 0 for
      // almost every tenant today).
      const performance = mockCompanyPerformance(company.id);

      return [
        company.name,
        <span key="subdomain" className="font-mono text-xs">
          {company.subdomain}
        </span>,
        COMPANY_TYPE_LABELS[company.companyType] ?? company.companyType,
        String(guides.length),
        String(performance.appOpens),
        String(performance.tipsSaved),
        String(performance.bookClicks),
        <StatusBadge
          key="status"
          status={STATUS_LABEL[company.status]}
          tone={STATUS_TONE[company.status]}
        />,
        <div key="actions" className="flex flex-wrap gap-2">
          {nextStatusActions(company.status).map((action) => (
            <form key={action.next} action={setCompanyStatusAction.bind(null, company.id, action.next)}>
              <button type="submit" className={statusActionButtonClass()}>
                {action.label}
              </button>
            </form>
          ))}
        </div>,
      ];
    }),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Companies</h1>
      <p className="mt-1 text-sm text-[var(--admin-ink-soft)]">
        {companies.length} tenant{companies.length === 1 ? "" : "s"} on the platform.
      </p>
      <p className="mt-1 text-xs text-[var(--admin-ink-soft)]">
        App opens, tips saved and book clicks are placeholder numbers until real event volume
        exists — see the comment on <code>mockCompanyPerformance</code> in
        src/lib/admin/mockAnalytics.ts.
      </p>

      <CreateCompanyForm />

      <AdminTable
        className="mt-6"
        columns={[
          "Company",
          "Subdomain",
          "Type",
          "Guides",
          "App opens",
          "Tips saved",
          "Book clicks",
          "Status",
          "Actions",
        ]}
        rows={rows}
        emptyMessage="No companies yet — onboard the first one above."
      />
    </div>
  );
}

// Admin > Companies > [company] — the "View details" destination now that
// the Companies table's row actions live behind a kebab menu
// (src/components/admin/CompanyRowActions.tsx) rather than a wall of
// inline buttons. Everything shown here was already fetched per-row on the
// list page; this just gives one company's own numbers and roster room to
// breathe on a dedicated page instead of a cramped table row.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ADMIN_ACTOR } from "@/lib/admin/actor";
import { companyPerformance } from "@/lib/admin/analytics";
import { getOwnerInvite } from "@/lib/admin/ownerInvite";
import {
  getAdminRecommendationsForCompany,
  getGuidesForCompany,
  getPlatformDefaultCompany,
  listCompanies,
} from "@/lib/data/source";
import type { GuideStatus } from "@/lib/data/types";
import AdminRecommendationsManager from "@/components/admin/AdminRecommendationsManager";
import AdminTable from "@/components/admin/AdminTable";
import CompanyRowActions from "@/components/admin/CompanyRowActions";
import { SectionHeading } from "@/components/admin/primitives";
import StatCard from "@/components/admin/StatCard";
import StatusBadge from "@/components/admin/StatusBadge";

export const metadata: Metadata = { title: "Company" };

// Matches src/app/admin/(protected)/companies/page.tsx's own label/tone
// maps exactly, so a company/guide reads the same wherever it's seen.
const STATUS_LABEL = { setup: "Setup", active: "Live", suspended: "Suspended" } as const;
const STATUS_TONE = { setup: "neutral", active: "positive", suspended: "warning" } as const;
const OWNER_STATUS_LABEL = { invited: "Invited", active: "Active" } as const;
const OWNER_STATUS_TONE = { invited: "neutral", active: "positive" } as const;
const GUIDE_STATUS_LABEL: Record<GuideStatus, string> = {
  invited: "Invited",
  active: "Active",
  deactivated: "Deactivated",
};
const GUIDE_STATUS_TONE: Record<GuideStatus, "positive" | "neutral" | "warning"> = {
  invited: "neutral",
  active: "positive",
  deactivated: "warning",
};

export default async function AdminCompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const companies = await listCompanies(ADMIN_ACTOR);
  const company = companies.find((c) => c.id === id);
  if (!company) notFound();

  const [guides, performance, invite, platformDefault, adminRecommendations] = await Promise.all([
    getGuidesForCompany(ADMIN_ACTOR, company.id),
    companyPerformance(company.id),
    getOwnerInvite(company.id),
    getPlatformDefaultCompany(),
    getAdminRecommendationsForCompany(ADMIN_ACTOR, company.id),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/companies"
          className="text-sm font-medium text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]"
        >
          ← Companies
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{company.name}</h1>
              <StatusBadge status={STATUS_LABEL[company.status]} tone={STATUS_TONE[company.status]} />
            </div>
            <p className="mt-1.5 text-sm text-[var(--admin-ink-soft)]">
              <span className="font-mono">{company.id}</span>
              {company.companyType ? (
                <span className="capitalize"> · {company.companyType}</span>
              ) : (
                ""
              )}
            </p>
          </div>
          <CompanyRowActions
            companyId={company.id}
            companyName={company.name}
            status={company.status}
            ownerInvite={invite}
          />
        </div>
      </div>

      <section>
        <SectionHeading title="Owner" />
        {company.ownerEmail ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm text-[var(--admin-ink)]">{company.ownerEmail}</span>
            {company.ownerStatus ? (
              <StatusBadge
                status={OWNER_STATUS_LABEL[company.ownerStatus]}
                tone={OWNER_STATUS_TONE[company.ownerStatus]}
              />
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--admin-ink-soft)]">No owner on record.</p>
        )}
      </section>

      <section>
        <SectionHeading
          title="Performance"
          description="Last 30 days."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="App opens" value={performance.appOpens} />
          <StatCard label="Tips saved" value={performance.tipsSaved} />
          <StatCard label="Book clicks" value={performance.bookClicks} />
        </div>
      </section>

      <section>
        <SectionHeading
          title="Guides"
          description={`${guides.length} guide${guides.length === 1 ? "" : "s"}`}
        />
        <AdminTable
          columns={["Name", "Email", "Slug", "Status"]}
          rows={guides.map((guide) => [
            guide.name,
            guide.email,
            <span key="slug" className="font-mono text-xs">
              {guide.slug}
            </span>,
            <StatusBadge
              key="status"
              status={GUIDE_STATUS_LABEL[guide.status]}
              tone={GUIDE_STATUS_TONE[guide.status]}
            />,
          ])}
          emptyMessage="No guides yet."
        />
      </section>

      <section>
        <SectionHeading
          title="Admin recommendations"
          description={`${adminRecommendations.length} admin-curated recommendation${
            adminRecommendations.length === 1 ? "" : "s"
          } for ${company.name}`}
        />
        <AdminRecommendationsManager
          companyId={company.id}
          companyName={company.name}
          initialRecommendations={adminRecommendations}
        />
      </section>
    </div>
  );
}

// Admin Companies (PRD §8.3): view/manage every tenant, per-company
// performance, and the full onboarding flow (create a company, optionally
// note its type). Every company starts in "setup" — Admin no longer picks
// an initial status; the company publishes itself live from Studio once
// it's ready (setCompanyStatus's own doc comment). Writes go through
// src/lib/admin/companyActions.ts -> createCompany / setCompanyStatus in
// src/lib/data/source.ts, admin-only and enforced there the same way RLS
// enforces it for real.

import type { Metadata } from "next";

import { ADMIN_ACTOR } from "@/lib/admin/actor";
import { companyPerformance } from "@/lib/admin/analytics";
import { getOwnerInvite } from "@/lib/admin/ownerInvite";
import { getGuidesForCompany, getPlatformDefaultCompany, listCompanies } from "@/lib/data/source";
import type { CompanyStatus } from "@/lib/data/types";
import AdminTable from "@/components/admin/AdminTable";
import CompanyRowActions from "@/components/admin/CompanyRowActions";
import CreateCompanyButton from "@/components/admin/CreateCompanyButton";
import { PageHeader } from "@/components/admin/primitives";
import StatusBadge from "@/components/admin/StatusBadge";

// One width per column (see AdminTable's own doc comment) — without these
// the browser's table auto-layout was squeezing "Company" down to wherever
// left space happened to land, wrapping a name as short as "Boat & Bike
// Co." onto two lines while Owner/Status sat mostly empty.
const COLUMN_WIDTHS = [
  "min-w-[180px]",
  // Wide enough for a full 36-char UUID in font-mono without wrapping — an
  // admin builds a guest link by hand from this value, so it stays
  // unabbreviated (see the "ID" column's own comment below).
  "min-w-[260px]",
  "min-w-[110px]",
  "min-w-[200px]",
  "w-20",
  "w-24",
  "w-24",
  "w-24",
  "w-24",
  "w-16",
];

export const metadata: Metadata = { title: "Companies" };

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

const OWNER_STATUS_TONE: Record<"invited" | "active", "neutral" | "positive"> = {
  invited: "neutral",
  active: "positive",
};

const OWNER_STATUS_LABEL: Record<"invited" | "active", string> = {
  invited: "Invited",
  active: "Active",
};

export default async function AdminCompaniesPage() {
  const companies = await listCompanies(ADMIN_ACTOR);
  // Fetched once for the whole table rather than per row — at most one
  // company can ever hold the flag (see the partial unique index in
  // supabase/migrations/20260823190000_platform_default_company.sql), so a
  // single lookup plus an id comparison per row is enough.
  const platformDefault = await getPlatformDefaultCompany();

  const rows = await Promise.all(
    companies.map(async (company) => {
      const guides = await getGuidesForCompany(ADMIN_ACTOR, company.id);
      // Real aggregation over `events` (src/lib/admin/analytics.ts).
      const performance = await companyPerformance(company.id);
      // Null once the owner has redeemed (owner_status='active') or if no
      // invite was ever issued — so the recovery controls only appear while
      // there is genuinely something pending.
      const invite = await getOwnerInvite(company.id);

      return [
        <span key="name" className="font-medium whitespace-nowrap">
          {company.name}
        </span>,
        // Full id, not a truncated prefix — an admin builds a guest link by
        // hand as `?company=<id>`, so the whole value needs to be readable
        // and selectable here, not just enough to disambiguate rows.
        <span key="id" className="font-mono text-xs">
          {company.id}
        </span>,
        company.companyType ? (
          <span
            key="type"
            className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300 capitalize"
          >
            {company.companyType}
          </span>
        ) : (
          <span key="type" className="text-[var(--admin-ink-soft)]">—</span>
        ),
        company.ownerEmail ? (
          <span key="owner" className="text-xs text-[var(--admin-ink)] block truncate max-w-[200px]" title={company.ownerEmail}>
            {company.ownerEmail}
          </span>
        ) : (
          <span key="owner" className="text-xs text-[var(--admin-ink-soft)]">
            —
          </span>
        ),
        String(guides.length),
        String(performance.appOpens),
        String(performance.tipsSaved),
        String(performance.bookClicks),
        <StatusBadge
          key="status"
          status={STATUS_LABEL[company.status]}
          tone={STATUS_TONE[company.status]}
        />,
        <CompanyRowActions
          key="actions"
          companyId={company.id}
          companyName={company.name}
          status={company.status}
          ownerInvite={invite}
          isPlatformDefault={company.id === platformDefault?.id}
        />,
      ];
    }),
  );

  return (
    <div>
      <PageHeader
        title="Companies"
        description={`${companies.length} tenant${companies.length === 1 ? "" : "s"} on the platform.`}
        hint="App opens, tips saved and book clicks are live counts from events, over the last 30 days."
        action={<CreateCompanyButton />}
      />

      <AdminTable
        columns={[
          "Company",
          "ID",
          "Type",
          "Owner",
          "Guides",
          "App opens",
          "Tips saved",
          "Book clicks",
          "Status",
          "Actions",
        ]}
        rows={rows}
        columnWidths={COLUMN_WIDTHS}
        emptyMessage="No companies yet — onboard the first one above."
      />
    </div>
  );
}

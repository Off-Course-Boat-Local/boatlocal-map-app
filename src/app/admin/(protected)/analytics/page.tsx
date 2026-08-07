import type { Metadata } from "next";

import { ADMIN_ACTOR } from "@/lib/admin/actor";
import { parseDateRangeParams } from "@/lib/admin/dateRange";
import { mockPlatformEffectiveness } from "@/lib/admin/mockAnalytics";
import {
  getBoatTours,
  getGuidesForCompany,
  getPlatformAnalyticsSummary,
  listBoatTourCatalog,
  listCompanies,
} from "@/lib/data/source";
import AdminTable from "@/components/admin/AdminTable";
import StatCard from "@/components/admin/StatCard";
import PortalDatePicker from "@/components/PortalDatePicker";
import PortalSelect from "@/components/PortalSelect";

export const metadata: Metadata = { title: "Platform analytics" };

type SearchParamValue = string | string[] | undefined;
type AnalyticsSearchParams = { company?: SearchParamValue; from?: SearchParamValue; to?: SearchParamValue };

/** Query params can arrive as string | string[] | undefined — normalize to one string or undefined. */
function firstParam(value: SearchParamValue): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<AnalyticsSearchParams>;
}) {
  const params = await searchParams;
  const companyId = firstParam(params.company);
  const fromStr = firstParam(params.from);
  const toStr = firstParam(params.to);
  const range = parseDateRangeParams({ from: fromStr, to: toStr });

  const companies = await listCompanies(ADMIN_ACTOR);
  const selectedCompany = companyId ? companies.find((c) => c.id === companyId) : undefined;
  const scopedCompanies = selectedCompany ? [selectedCompany] : companies;

  // Same metric set as Overview's KPI row (Companies / Guides / Boat tours /
  // Tracked events — src/app/admin/(protected)/page.tsx), but here every one
  // of them actually responds to the company filter, and "Tracked events"
  // additionally responds to the date-range filter via the real
  // getPlatformAnalyticsSummary(range) call below.
  //
  // Boat tours are admin-owned and platform-wide, not company-owned (PRD
  // §8.2) — "in scope" for a selected company means "featured by that
  // company" (getBoatTours, the same read the guest map uses, which has no
  // `status` field since hidden tours are already excluded); otherwise it's
  // the whole admin catalog, which does carry `status`. Resolved as one
  // `{ count, hint }` pair up front so the JSX below never has to narrow a
  // BoatTourView | BoatTourRecord union.
  const [guidesPerScopedCompany, boatTours, analytics] = await Promise.all([
    Promise.all(scopedCompanies.map((company) => getGuidesForCompany(ADMIN_ACTOR, company.id))),
    selectedCompany
      ? getBoatTours(selectedCompany.id).then((tours) => ({
          count: tours.length,
          hint: "featured by this company",
        }))
      : listBoatTourCatalog(ADMIN_ACTOR).then((tours) => ({
          count: tours.length,
          hint: `${tours.filter((t) => t.status === "active").length} active`,
        })),
    getPlatformAnalyticsSummary(ADMIN_ACTOR, range),
  ]);

  const totalGuidesInScope = guidesPerScopedCompany.reduce((sum, g) => sum + g.length, 0);
  const scopedAnalytics = selectedCompany
    ? analytics.filter((row) => row.companyId === selectedCompany.id)
    : analytics;
  const totalEvents = scopedAnalytics.reduce((sum, row) => sum + row.count, 0);

  const totalsByType = new Map<string, number>();
  for (const row of scopedAnalytics) {
    totalsByType.set(row.eventType, (totalsByType.get(row.eventType) ?? 0) + row.count);
  }
  const maxTypeCount = Math.max(1, ...totalsByType.values());

  const byCompany = new Map<string, { companyName: string; count: number }>();
  for (const row of scopedAnalytics) {
    const existing = byCompany.get(row.companyId);
    byCompany.set(row.companyId, {
      companyName: row.companyName,
      count: (existing?.count ?? 0) + row.count,
    });
  }

  // Placeholder PRD §2.3 effectiveness metrics — see
  // src/lib/admin/mockAnalytics.ts. Seeded off the current filter state so
  // the date-range and company filters visibly change something even
  // before real event volume exists to aggregate.
  const effectivenessSeed = `${selectedCompany?.id ?? "all"}::${fromStr ?? ""}::${toStr ?? ""}`;
  const effectiveness = mockPlatformEffectiveness(effectivenessSeed);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Platform analytics</h1>
      <p className="mt-1 text-sm text-[var(--admin-ink-soft)]">
        {totalEvents} event{totalEvents === 1 ? "" : "s"} recorded
        {selectedCompany ? ` for ${selectedCompany.name}` : " across every tenant"}
        {range ? " in the selected date range" : ""}.
      </p>

      <div className="mt-6 rounded-lg border border-[var(--admin-accent)]/40 bg-[var(--admin-surface)] p-4">
        <p className="text-sm font-semibold text-[var(--admin-ink)]">Why this page matters</p>
        <p className="mt-1 text-sm text-[var(--admin-ink-soft)]">
          This is where the founder judges whether the whole product is working — not any single
          company&apos;s dashboard. If bookings and reviews aren&apos;t moving here, the platform
          isn&apos;t working yet, no matter how good one tenant looks.
        </p>
      </div>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <div>
          <label htmlFor="company" className="block text-xs font-medium text-[var(--admin-ink-soft)]">
            Company
          </label>
          <PortalSelect
            id="company"
            name="company"
            defaultValue={companyId ?? ""}
            placeholder="All companies"
            options={companies.map((company) => ({ value: company.id, label: company.name }))}
            className="mt-1 w-48"
          />
        </div>
        <div>
          <label htmlFor="from" className="block text-xs font-medium text-[var(--admin-ink-soft)]">
            From
          </label>
          <PortalDatePicker id="from" name="from" defaultValue={fromStr} className="mt-1" />
        </div>
        <div>
          <label htmlFor="to" className="block text-xs font-medium text-[var(--admin-ink-soft)]">
            To
          </label>
          <PortalDatePicker id="to" name="to" defaultValue={toStr} className="mt-1" />
        </div>
        <button
          type="submit"
          className="rounded-md bg-[var(--admin-accent-strong)] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Apply
        </button>
        {companyId || fromStr || toStr ? (
          <a
            href="/admin/analytics"
            className="text-sm text-[var(--admin-ink-soft)] underline-offset-2 hover:underline"
          >
            Reset
          </a>
        ) : null}
      </form>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Companies"
          value={selectedCompany ? 1 : companies.length}
          hint={selectedCompany ? selectedCompany.name : `${companies.filter((c) => c.status === "active").length} active`}
        />
        <StatCard label="Guides" value={totalGuidesInScope} />
        <StatCard label="Boat tours" value={boatTours.count} hint={boatTours.hint} />
        <StatCard
          label="Tracked events"
          value={totalEvents}
          hint={range ? "in selected range" : "all time"}
        />
      </div>

      <section className="mt-6 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <h2 className="text-sm font-semibold text-[var(--admin-ink)]">
          Effectiveness (PRD §2.3 supporting metrics)
        </h2>
        <p className="mt-1 text-xs text-[var(--admin-ink-soft)]">
          Placeholder numbers — the fake store seeds zero events, so real figures would all read 0
          today. Deterministically generated from the filters above; see
          src/lib/admin/mockAnalytics.ts.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {effectiveness.map((metric) => (
            <div key={metric.key}>
              <p className="text-xs font-medium tracking-wide text-[var(--admin-ink-soft)] uppercase">
                {metric.label}
              </p>
              <p className="mt-1 text-xl font-semibold text-[var(--admin-ink)]">
                {metric.value}
                {metric.unit ?? ""}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <h2 className="text-sm font-semibold text-[var(--admin-ink)]">By event type</h2>
          <div className="mt-4 space-y-3">
            {[...totalsByType.entries()].map(([type, count]) => (
              <div key={type}>
                <div className="flex items-center justify-between text-xs text-[var(--admin-ink-soft)]">
                  <span>{type}</span>
                  <span>{count}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-[var(--admin-border)]">
                  <div
                    className="h-1.5 rounded-full bg-[var(--admin-accent)]"
                    style={{ width: `${(count / maxTypeCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {totalsByType.size === 0 ? (
              <p className="text-sm text-[var(--admin-ink-soft)]">No events recorded yet.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <h2 className="text-sm font-semibold text-[var(--admin-ink)]">By company</h2>
          <AdminTable
            className="mt-4"
            columns={["Company", "Events"]}
            rows={[...byCompany.values()].map((company) => [company.companyName, String(company.count)])}
            emptyMessage="No events recorded yet."
          />
        </section>
      </div>
    </div>
  );
}

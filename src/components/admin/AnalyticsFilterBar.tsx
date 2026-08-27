"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import PortalSelect from "@/components/PortalSelect";
import PortalDatePicker from "@/components/PortalDatePicker";
import { PRIMARY_BUTTON_CLASS } from "@/components/admin/primitives";

export interface AnalyticsFilterBarProps {
  companies: Array<{ id: string; name: string }>;
  currentCompanyId?: string;
  currentFrom?: string;
  currentTo?: string;
}

export default function AnalyticsFilterBar({
  companies,
  currentCompanyId,
  currentFrom,
  currentTo,
}: AnalyticsFilterBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [companyId, setCompanyId] = useState(currentCompanyId ?? "");
  const [fromDate, setFromDate] = useState(currentFrom ?? "");
  const [toDate, setToDate] = useState(currentTo ?? "");

  function applyFilters(newCompany?: string, newFrom?: string, newTo?: string) {
    const activeCompany = newCompany !== undefined ? newCompany : companyId;
    const activeFrom = newFrom !== undefined ? newFrom : fromDate;
    const activeTo = newTo !== undefined ? newTo : toDate;

    const params = new URLSearchParams();
    if (activeCompany) params.set("company", activeCompany);
    if (activeFrom) params.set("from", activeFrom);
    if (activeTo) params.set("to", activeTo);

    startTransition(() => {
      router.push(`/admin/analytics${params.toString() ? `?${params.toString()}` : ""}`);
    });
  }

  function handleReset() {
    setCompanyId("");
    setFromDate("");
    setToDate("");
    startTransition(() => {
      router.push("/admin/analytics");
    });
  }

  const hasActiveFilters = Boolean(currentCompanyId || currentFrom || currentTo);

  return (
    <div className="flex flex-wrap items-end gap-3.5">
      <div className="w-56">
        <label htmlFor="company-filter" className="mb-1 block text-xs font-semibold text-[var(--admin-ink-soft)]">
          Company filter
        </label>
        <PortalSelect
          id="company-filter"
          name="company"
          defaultValue={companyId}
          placeholder="All companies (Platform)"
          options={companies.map((c) => ({ value: c.id, label: c.name }))}
          onValueChange={(val) => {
            setCompanyId(val);
            applyFilters(val, undefined, undefined);
          }}
        />
      </div>

      <div>
        <label htmlFor="from-filter" className="mb-1 block text-xs font-semibold text-[var(--admin-ink-soft)]">
          From date
        </label>
        <PortalDatePicker
          id="from-filter"
          name="from"
          defaultValue={fromDate}
        />
      </div>

      <div>
        <label htmlFor="to-filter" className="mb-1 block text-xs font-semibold text-[var(--admin-ink-soft)]">
          To date
        </label>
        <PortalDatePicker
          id="to-filter"
          name="to"
          defaultValue={toDate}
        />
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={(e) => {
          // Read DOM values from hidden inputs rendered by PortalDatePicker
          const form = e.currentTarget.closest("div")?.parentElement;
          const fromInput = form?.querySelector<HTMLInputElement>('input[name="from"]')?.value;
          const toInput = form?.querySelector<HTMLInputElement>('input[name="to"]')?.value;
          applyFilters(undefined, fromInput, toInput);
        }}
        className={PRIMARY_BUTTON_CLASS}
      >
        {isPending ? "Updating…" : "Apply Range"}
      </button>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleReset}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-xs font-medium text-[var(--admin-ink)] shadow-xs transition-colors hover:bg-[var(--admin-bg)]"
        >
          <RotateCcw className="size-3.5 text-[var(--admin-ink-soft)]" />
          Reset filters
        </button>
      )}
    </div>
  );
}

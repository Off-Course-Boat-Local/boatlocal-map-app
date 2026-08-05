// A responsive row of KpiCards. Used for both the company KPI row (PRD
// §7.1: active guides / app opens / tips saved / tours booked) and the
// guide's smaller personal-stats row (PRD §6.4: app opens / book-clicks /
// number of places) — same component, different `items`.

import KpiCard from "./KpiCard";
import type { KpiItem } from "./types";

export default function KpiRow({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <KpiCard key={item.key} item={item} />
      ))}
    </div>
  );
}

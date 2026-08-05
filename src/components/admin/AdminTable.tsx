import type { ReactNode } from "react";

export interface AdminTableProps {
  columns: string[];
  /** Each row is an ordered list of cells, matching `columns`. Cells may be plain strings or small components (e.g. StatusBadge). */
  rows: ReactNode[][];
  emptyMessage?: string;
  className?: string;
}

export default function AdminTable({
  columns,
  rows,
  emptyMessage = "Nothing here yet.",
  className,
}: AdminTableProps) {
  return (
    <div
      className={[
        "overflow-x-auto rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]",
        className ?? "",
      ].join(" ")}
    >
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--admin-border)] text-left">
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-4 py-3 text-xs font-semibold tracking-wide text-[var(--admin-ink-soft)] uppercase"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-[var(--admin-ink-soft)]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-[var(--admin-border)] last:border-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 align-top text-[var(--admin-ink)]">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

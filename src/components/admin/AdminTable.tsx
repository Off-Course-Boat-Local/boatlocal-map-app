import type { ReactNode } from "react";

export interface AdminTableProps {
  columns: string[];
  /** Each row is an ordered list of cells, matching `columns`. Cells may be plain strings or small components (e.g. StatusBadge). */
  rows: ReactNode[][];
  emptyMessage?: string;
  className?: string;
  /**
   * Tailwind width classes, one per column, applied to both the header and
   * body cells (e.g. `["min-w-[220px]", "w-32", undefined]`). Omit an
   * index (or the whole prop) to leave that column's width up to the
   * browser's own table auto-layout, same as before this existed — every
   * other AdminTable caller keeps its current sizing untouched.
   */
  columnWidths?: Array<string | undefined>;
}

export default function AdminTable({
  columns,
  rows,
  emptyMessage = "Nothing here yet.",
  className,
  columnWidths,
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
            {columns.map((column, columnIndex) => (
              <th
                key={column}
                scope="col"
                className={[
                  "px-4 py-3 text-xs font-semibold tracking-wide text-[var(--admin-ink-soft)] uppercase",
                  columnWidths?.[columnIndex] ?? "",
                ].join(" ")}
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
                  <td
                    key={cellIndex}
                    className={[
                      "px-4 py-3 align-top text-[var(--admin-ink)]",
                      columnWidths?.[cellIndex] ?? "",
                    ].join(" ")}
                  >
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

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

// Card-shaped table matching the reference design's TableShell
// (nice-notice/src/components/admin/primitives.tsx): rounded-2xl + shadow
// container (rather than a flat border box), a tinted header row, uppercase
// tracked column labels, and roomier cell padding. Structure/props are
// unchanged — every existing caller keeps its columns/rows/emptyMessage
// exactly as before.
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
        "overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow-card)]",
        className ?? "",
      ].join(" ")}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-bg)]/60 text-left">
              {columns.map((column, columnIndex) => (
                <th
                  key={column}
                  scope="col"
                  className={[
                    "px-5 py-3 text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--admin-ink-soft)] uppercase whitespace-nowrap",
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
                <td colSpan={columns.length} className="px-5 py-10 text-center text-[var(--admin-ink-soft)]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-[var(--admin-border)]/70 transition-colors last:border-0 hover:bg-[var(--admin-bg)]/40"
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={[
                        // Nowrap, unconditionally: a long name (a real
                        // BoatLocal cruise title easily runs 60+ characters)
                        // must push the column wider and let the table's own
                        // overflow-x-auto scroll horizontally, never wrap
                        // into a multi-line cell that balloons every row's
                        // height as the viewport narrows.
                        "px-5 py-4 align-middle whitespace-nowrap text-[var(--admin-ink)]",
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
    </div>
  );
}

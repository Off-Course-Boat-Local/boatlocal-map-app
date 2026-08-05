// Pure CSV building for Studio exports (PRD §7.7 Report's "Download CSV").
// No DOM/Blob dependency here on purpose — that lives in
// src/components/studio/DownloadCsvButton.tsx (a Client Component) so this
// module stays trivially unit-testable and reusable from any future export.

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number;
}

/** RFC 4180-ish: quote a cell iff it contains a comma, quote, or newline; double any embedded quotes. */
function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Builds a CSV string (CRLF line endings) from rows + column definitions. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCsvCell(c.value(row))).join(","));
  return [header, ...lines].join("\r\n");
}

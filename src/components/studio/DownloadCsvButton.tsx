"use client";

// Studio's "Download CSV" control (PRD §7.7 Report). Takes an already-built
// CSV string (src/lib/studio/csv.ts's toCsv) — no data-shaping happens here,
// just handing the browser a file to save.

import { Download } from "lucide-react";

import { GhostButton } from "./primitives";

export default function DownloadCsvButton({
  csv,
  filename,
}: {
  csv: string;
  filename: string;
}) {
  function handleClick() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <GhostButton size="sm" onClick={handleClick}>
      <Download className="size-4" strokeWidth={2} />
      Download CSV
    </GhostButton>
  );
}

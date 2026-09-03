// Affiliate outreach — bulk CSV import for the funnel-refill routine
// (docs/outreach-research.md). Same bearer-secret gating as the
// candidates endpoint next to this one, and the same parser + upsert the
// admin's own "Import CSV" button uses (outreachCsv.ts,
// upsertOutreachProspectsFromCsv) — just via the service-role variant,
// since this route has no signed-in admin session either. Every row this
// endpoint writes is tagged source: "agent" regardless of who actually
// calls it, because that's what the tag means here: "came in through the
// API, not by hand through the button" — see outreachCsv.ts's own comment
// on why Source isn't read from the file.

import { NextResponse } from "next/server";

import { upsertOutreachProspectsFromCsvViaService, type OutreachSegment } from "@/lib/data/outreach";
import { parseOutreachCsv } from "@/lib/admin/outreachCsv";
import { isSlackConfigured, postToSlack } from "@/lib/slack/client";

function checkAuth(request: Request): boolean {
  const secret = process.env.OUTREACH_IMPORT_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

const VALID_SEGMENTS: OutreachSegment[] = ["operator", "hotel", "agency"];

export async function POST(request: Request) {
  if (!process.env.OUTREACH_IMPORT_SECRET) {
    console.error("[outreach-import] OUTREACH_IMPORT_SECRET is not set — refusing all requests");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data with a file field" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  const rawSegment = formData.get("segment");
  const defaultSegment =
    typeof rawSegment === "string" && (VALID_SEGMENTS as string[]).includes(rawSegment)
      ? (rawSegment as OutreachSegment)
      : "operator";

  const text = await file.text();
  const { records, skippedNames } = parseOutreachCsv(text, { defaultSegment, source: "agent" });
  if (records.length === 0) {
    return NextResponse.json({ error: "no prospects found in that file" }, { status: 400 });
  }

  const { created, updated } = await upsertOutreachProspectsFromCsvViaService(records);

  if (isSlackConfigured()) {
    const bySegment = records.reduce<Record<string, number>>((acc, r) => {
      acc[r.segment] = (acc[r.segment] ?? 0) + 1;
      return acc;
    }, {});
    const segmentSummary = Object.entries(bySegment)
      .map(([segment, count]) => `${count} ${segment}${count === 1 ? "" : "s"}`)
      .join(", ");
    const skippedNote = skippedNames.length > 0 ? ` · ${skippedNames.length} excluded` : "";
    const result = await postToSlack(
      `*Research: ${segmentSummary} added* (${created} new, ${updated} updated)${skippedNote}`,
    );
    if (!result.ok) {
      console.error(`[outreach-import] Slack post failed: ${result.error}`);
    }
  }

  return NextResponse.json({ ok: true, created, updated, skipped: skippedNames.length });
}

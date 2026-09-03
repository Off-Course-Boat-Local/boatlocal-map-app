// Vercel Cron -> once-daily Slack digest of affiliate outreach follow-ups
// that are due (supabase/migrations/20260903140000_outreach_prospects.sql).
//
// Deliberately dumb: one message a day listing everything with
// next_action_due_at <= now, no per-prospect "already notified today" flag.
// A prospect that's overdue and gets no attention just reappears in
// tomorrow's digest too — that's the correct behaviour for a reminder (silently
// going stale would be worse), and tracking "already told you" state would
// be a second thing this feature could get out of sync on for no real
// benefit. Same CRON_SECRET bearer-token pattern as
// src/app/api/cron/sync-boat-tours/route.ts — see that file's own comment
// for why this is the standard shape for a Vercel Cron endpoint here.

import { NextResponse } from "next/server";

import { listDueOutreachProspects } from "@/lib/data/outreach";
import { isSlackConfigured, postToSlack } from "@/lib/slack/client";

function formatDueLine(prospect: {
  name: string;
  nextActionType: string | null;
  nextActionDueAt: string | null;
}): string {
  const action = prospect.nextActionType === "call" ? "Call" : "Follow-up email";
  const dueDate = prospect.nextActionDueAt
    ? new Date(prospect.nextActionDueAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })
    : "unknown date";
  return `• *${prospect.name}* — ${action} due (was scheduled ${dueDate})`;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[outreach-reminders] CRON_SECRET is not set — refusing all requests");
    return NextResponse.json({ ok: false, error: "cron not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const due = await listDueOutreachProspects();

  if (due.length === 0) {
    return NextResponse.json({ ok: true, due: 0, posted: false });
  }

  if (!isSlackConfigured()) {
    // Not an error: SLACK_OUTREACH_WEBHOOK_URL is documented as optional in
    // .env.example. Logged so it's visible in Vercel's cron logs that
    // reminders exist but nobody was told, rather than failing silently.
    console.warn(
      `[outreach-reminders] ${due.length} prospect(s) due but SLACK_OUTREACH_WEBHOOK_URL is not set`,
    );
    return NextResponse.json({ ok: true, due: due.length, posted: false });
  }

  const heading =
    due.length === 1
      ? "*1 affiliate outreach follow-up is due:*"
      : `*${due.length} affiliate outreach follow-ups are due:*`;
  const text = [heading, ...due.map(formatDueLine)].join("\n");

  const result = await postToSlack(text);
  if (!result.ok) {
    console.error(`[outreach-reminders] Slack post failed: ${result.error}`);
    return NextResponse.json({ ok: false, due: due.length, posted: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, due: due.length, posted: true });
}

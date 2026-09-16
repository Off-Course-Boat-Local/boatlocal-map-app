// Vercel Cron -> Daily 10:00 PM Amsterdam digest for #BoatLocal-ops.
// Summarizes partner outreach activity logs and company changes that took place
// during the current day.
//
// Gated with CRON_SECRET bearer token, matching src/app/api/cron/outreach-reminders.

import { NextResponse } from "next/server";

import { getDailyOpsDigestData, formatDailyOpsDigestSlackMessage } from "@/lib/ops/dailyDigest";
import { isOpsSlackConfigured, postToOpsSlack } from "@/lib/slack/client";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[daily-ops-digest] CRON_SECRET is not set — refusing all requests");
    return NextResponse.json({ ok: false, error: "cron not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const data = await getDailyOpsDigestData();
    const text = formatDailyOpsDigestSlackMessage(data);

    if (!isOpsSlackConfigured()) {
      console.warn(
        "[daily-ops-digest] Neither SLACK_OPS_WEBHOOK_URL nor SLACK_OUTREACH_WEBHOOK_URL is set",
      );
      return NextResponse.json({ ok: true, posted: false, message: text });
    }

    const result = await postToOpsSlack(text);
    if (!result.ok) {
      console.error(`[daily-ops-digest] Slack post failed: ${result.error}`);
      return NextResponse.json(
        { ok: false, posted: false, error: result.error },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      posted: true,
      prospectsCount: data.prospectActivities.length,
      companiesCount: data.companyChanges.length,
    });
  } catch (err) {
    console.error("[daily-ops-digest] execution failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// Inbound email webhook: Resend -> us, "email.received"
// Automatically logs incoming email replies against outreach prospects in Supabase,
// advances their pipeline status to 'replied', and posts a notification to Slack.

import { NextResponse } from "next/server";
import { verifyResendWebhook } from "@/lib/email/resendWebhook";
import { getInboundEmail } from "@/lib/email/client";
import { recordInboundReplyByEmail } from "@/lib/data/outreach";
import { postToSlack, isSlackConfigured } from "@/lib/slack/client";

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const rawBody = await request.text();

  // Verify webhook signature if secret is configured
  if (secret) {
    const verified = verifyResendWebhook({
      rawBody,
      headers: {
        id: request.headers.get("svix-id"),
        timestamp: request.headers.get("svix-timestamp"),
        signature: request.headers.get("svix-signature"),
      },
      secret,
    });

    if (!verified) {
      console.warn("[resend-inbound] Webhook signature verification failed");
      return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
    }
  }

  let payload: { type?: string; data?: { email_id?: string; from?: string; subject?: string } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  // Handle email.received events
  if (payload.type === "email.received" && payload.data?.email_id) {
    try {
      const { data: emailData, error: fetchErr } = await getInboundEmail(payload.data.email_id);

      if (fetchErr || !emailData) {
        console.error("[resend-inbound] Failed to fetch receiving email details:", fetchErr);
        return NextResponse.json({ ok: false, error: "failed to fetch email" }, { status: 500 });
      }

      // Extract sender address from e.g. "Mikael <info@kingbikes.nl>" or "info@kingbikes.nl"
      const fromRaw = emailData.from || "";
      const emailMatch = fromRaw.match(/<([^>]+)>/) || [null, fromRaw.trim()];
      const senderEmail = (emailMatch[1] || "").toLowerCase();

      const bodyText = (emailData.text || emailData.html || "").trim();
      const snippet = bodyText.slice(0, 1000);

      const result = await recordInboundReplyByEmail({
        fromEmail: senderEmail,
        subject: emailData.subject,
        bodySnippet: snippet,
      });

      if (result.matched && result.prospect) {
        console.log(`[resend-inbound] Matched reply to prospect: ${result.prospect.name} (${senderEmail})`);

        if (isSlackConfigured()) {
          const slackText = `*New Reply from ${result.prospect.name}* (${senderEmail})\n> *Subject:* ${emailData.subject || "No subject"}\n\n${snippet.slice(0, 280)}...`;
          await postToSlack(slackText);
        }
      } else {
        console.log(`[resend-inbound] Inbound email received from unlisted sender: ${senderEmail}`);
      }

      return NextResponse.json({ ok: true, matched: result.matched });
    } catch (err) {
      console.error("[resend-inbound] Error processing received email:", err);
      return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, ignored: true });
}

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

        // Forward a copy to Gmail inbox info@boatlocal.nl so it also arrives in Gmail
        try {
          const { sendEmail } = await import("@/lib/email/client");
          await sendEmail({
            to: "info@boatlocal.nl",
            subject: `[Outreach Reply] ${emailData.subject || "Reply"} - ${result.prospect.name}`,
            text: `Reply received from ${result.prospect.name} (${senderEmail}):\n\n${snippet}\n\nView in Map App: https://map.boatlocal.nl/admin/outreach/${result.prospect.id}`,
            html: `<p><strong>Reply received from ${result.prospect.name}</strong> (${senderEmail})</p><blockquote style="border-left: 3px solid #1B5FE3; padding-left: 12px; margin: 12px 0;">${snippet.replace(/\n/g, "<br/>")}</blockquote><p><a href="https://map.boatlocal.nl/admin/outreach/${result.prospect.id}">View and reply in Map App</a></p>`,
          });
        } catch (fwdErr) {
          console.error("[resend-inbound] Failed to forward copy to info@boatlocal.nl:", fwdErr);
        }

        if (isSlackConfigured()) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://map.boatlocal.nl";
          const slackText = `📬 *New Outreach Reply from ${result.prospect.name}* (${senderEmail})\n> *Subject:* ${emailData.subject || "No subject"}\n\n${snippet.slice(0, 500)}\n\n🔗 <${appUrl}/admin/outreach/${result.prospect.id}|View & reply in Map App>`;
          await postToSlack(slackText);
        }

        const { revalidatePath } = await import("next/cache");
        revalidatePath("/admin/outreach");
        revalidatePath(`/admin/outreach/${result.prospect.id}`);
      } else {
        console.log(`[resend-inbound] Inbound email received from unlisted sender: ${senderEmail}`);

        // Safety net: ALWAYS forward to Gmail so no inbound message is ever lost
        try {
          const { sendEmail } = await import("@/lib/email/client");
          await sendEmail({
            to: "info@boatlocal.nl",
            subject: `[Unmatched Inbound Email] ${emailData.subject || "No subject"} (from ${senderEmail})`,
            text: `Inbound email received at reply@reply.boatlocal.nl from an address not matched to an active prospect (${senderEmail}):\n\n${snippet}`,
            html: `<p><strong>Inbound email received from unlisted sender:</strong> ${senderEmail}</p><blockquote style="border-left: 3px solid #f59e0b; padding-left: 12px; margin: 12px 0;">${snippet.replace(/\n/g, "<br/>")}</blockquote><p>Check the outreach list or respond from Gmail.</p>`,
          });
        } catch (fwdErr) {
          console.error("[resend-inbound] Failed to forward unmatched copy to info@boatlocal.nl:", fwdErr);
        }

        if (isSlackConfigured()) {
          const slackText = `⚠️ *Inbound Email from Unmatched Sender* (${senderEmail})\n> *Subject:* ${emailData.subject || "No subject"}\n\n${snippet.slice(0, 500)}`;
          await postToSlack(slackText);
        }
      }

      return NextResponse.json({ ok: true, matched: result.matched });
    } catch (err) {
      console.error("[resend-inbound] Error processing received email:", err);
      return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, ignored: true });
}

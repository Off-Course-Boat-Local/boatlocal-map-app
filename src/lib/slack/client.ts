// SERVER-ONLY: posts to a Slack Incoming Webhook. `import "server-only"`
// guards this the same way src/lib/email/client.ts guards RESEND_API_KEY —
// an accidental import from a Client Component fails the build loudly
// rather than bundling the webhook URL (itself a bearer credential: anyone
// who has it can post to the channel) into a browser chunk.
//
// Incoming Webhook, not a bot token: this only ever needs to POST one
// message to one fixed channel (outreach reminders), never read Slack
// state or post as an interactive app, so the simplest credential that
// does the job is a single URL from Slack's "Incoming Webhooks" app config
// — no scopes, no token rotation, no bot user to maintain. If a future
// feature needs Slack to do more than that, that's the point to introduce
// a real bot token; this module shouldn't grow bot-token complexity to
// serve a use case that doesn't exist yet.

import "server-only";

const SLACK_WEBHOOK_URL = process.env.SLACK_OUTREACH_WEBHOOK_URL;

export function isSlackConfigured(): boolean {
  return Boolean(SLACK_WEBHOOK_URL);
}

export type PostToSlackResult = { ok: true } | { ok: false; error: string };

/**
 * Posts one plain-text message to the configured Incoming Webhook.
 *
 * Returns a result rather than throwing — same reasoning as sendEmail() in
 * src/lib/email/client.ts: this is always a best-effort notification about
 * something that already happened (a reminder became due), never a write
 * a caller should roll anything back over if it fails.
 */
export async function postToSlack(text: string): Promise<PostToSlackResult> {
  if (!SLACK_WEBHOOK_URL) {
    return { ok: false, error: "SLACK_OUTREACH_WEBHOOK_URL is not set." };
  }

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, error: `Slack returned ${response.status}: ${body || "no body"}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error posting to Slack.",
    };
  }
}

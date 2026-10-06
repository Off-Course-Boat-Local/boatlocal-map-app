import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const resend = new Resend(env.RESEND_API_KEY);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const prospectId = "705fa178-66a7-4b8c-a81d-734fa8bc6ce9";
const ownerEmail = "Savvy@thoseamsterdames.com";
const companyName = "Those Amsterdames";
const companyType = "Private Walking";

async function run() {
  // 1. Create company record
  const inviteToken = crypto.randomUUID();
  console.log("Creating company for:", companyName);

  const { data: newCompany, error: compErr } = await admin
    .from("companies")
    .insert({
      name: companyName,
      company_type: companyType,
      app_name: companyName,
      brand_primary: "#52525B",
      brand_primary_dark: "#3F3F46",
      brand_accent: "#A1A1AA",
      brand_surround: "#F4F4F5",
      status: "setup",
      owner_email: ownerEmail,
      owner_status: "invited",
      owner_invite_token: inviteToken,
    })
    .select()
    .single();

  if (compErr) {
    console.error("Error creating company:", compErr);
    process.exit(1);
  }

  console.log("✓ Company created with ID:", newCompany.id);

  // 2. Update outreach_prospects
  const { error: prosErr } = await admin
    .from("outreach_prospects")
    .update({
      status: "onboarded",
      email: ownerEmail,
      company_id: newCompany.id,
      next_action_type: null,
      next_action_due_at: null,
    })
    .eq("id", prospectId);

  if (prosErr) {
    console.error("Error updating prospect:", prosErr);
    process.exit(1);
  }
  console.log("✓ Outreach prospect updated to onboarded & company linked.");

  // 3. Log event in outreach_events
  const { error: evErr } = await admin
    .from("outreach_events")
    .insert({
      prospect_id: prospectId,
      event_type: "onboarded",
      body: `Onboarded as a company (owner invited at ${ownerEmail}).`,
    });

  if (evErr) {
    console.error("Error logging event:", evErr);
    process.exit(1);
  }
  console.log("✓ Outreach event logged.");

  // 4. Send Owner Invite Email
  const baseUrl = "https://map.boatlocal.nl";
  const inviteUrl = `${baseUrl}/join/${inviteToken}`;

  function escapeHtml(val) {
    return val
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const safeName = escapeHtml(companyName);
  const safeUrl = escapeHtml(inviteUrl);

  const ACCENT = "#1B5FE3";
  const INK = "#1a1c22";
  const INK_SOFT = "#6b7280";
  const BG = "#f6f6f3";

  const emailHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Set up ${safeName} on Map App</title>
  </head>
  <body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <tr>
              <td style="font-size:20px;font-weight:700;color:${INK};padding-bottom:12px;letter-spacing:-0.02em;">You've been invited</td>
            </tr>
            <tr>
              <td style="font-size:14.5px;line-height:22px;color:${INK_SOFT};padding-bottom:24px;">Your account for <strong style="color:${INK};">${safeName}</strong> is ready. Set a password and finish setting up your company — branding, your logo, and the recommendations your guests will see.</td>
            </tr>
            <tr>
              <td>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background:${ACCENT};">
                      <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;letter-spacing:0.01em;">Set up your account</a>
                    </td>
                  </tr>
                </table>
                <p style="font-size:12px;line-height:18px;color:${INK_SOFT};margin:20px 0 0;">
                  Button not working? Paste this link into your browser:<br />
                  <a href="${safeUrl}" style="color:${ACCENT};word-break:break-all;text-decoration:none;">${safeUrl}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding-top:32px;border-top:1px solid #f3f4f6;margin-top:24px;">
                <p style="font-size:11.5px;line-height:16px;color:#9ca3af;margin:0 0 8px;">
                  If you did not request or expect this email, you can safely ignore it.
                </p>
                <p style="font-size:11.5px;line-height:16px;color:#9ca3af;margin:0;">
                  Map App by Boat Local · Amsterdam, Netherlands · <a href="${baseUrl}" style="color:#6b7280;text-decoration:underline;">boatlocal.nl</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const emailText = [
    "You've been invited to Map App",
    "",
    `Your account for ${companyName} is ready. Set a password and finish`,
    "setting up your company — branding, your logo, and the recommendations",
    "your guests will see.",
    "",
    inviteUrl,
  ].join("\n");

  console.log("Sending owner invite email to:", ownerEmail);
  const { data: sendData, error: sendErr } = await resend.emails.send({
    from: env.RESEND_FROM,
    to: ownerEmail,
    subject: `Set up ${companyName} on Map App`,
    html: emailHtml,
    text: emailText,
    replyTo: env.RESEND_REPLY_TO || undefined,
  });

  if (sendErr) {
    console.error("Resend error sending invite:", sendErr);
  } else {
    console.log("✓ Invite email sent! Resend ID:", sendData.id);
  }

  console.log("\nInvite URL (also available in admin):", inviteUrl);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

// DEV-ONLY. Renders a transactional email template in the browser so its
// layout can be checked without sending anything. Same shape and same
// production guard as src/app/api/dev/attribution-preview/route.ts.
//
// GET /api/dev/email-preview            -> company-owner invite (HTML)
// GET /api/dev/email-preview?format=text -> its plain-text alternative
//
// 404s outside development. This renders only — it never calls sendEmail(),
// so hitting it cannot deliver mail to anyone.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { emailBaseUrl, isEmailConfigured } from "@/lib/email/client";
import { companyOwnerInviteEmail } from "@/lib/email/templates";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  const format = request.nextUrl.searchParams.get("format");

  // A representative sample, not real data — nothing here touches the
  // database. The company name deliberately contains an apostrophe so the
  // escaping in templates.ts is visible in the rendered output.
  const baseUrl = emailBaseUrl();
  const email = companyOwnerInviteEmail({
    companyName: "Jan's Canal Hotel",
    inviteUrl: `${baseUrl}/join/preview-token-not-a-real-invite`,
    baseUrl,
  });

  if (format === "text") {
    return new NextResponse(
      [
        `Subject: ${email.subject}`,
        `Email configured: ${isEmailConfigured() ? "yes" : "no (RESEND_API_KEY / RESEND_FROM missing)"}`,
        "",
        email.text,
      ].join("\n"),
      { headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  return new NextResponse(email.html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

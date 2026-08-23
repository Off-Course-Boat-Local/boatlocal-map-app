// SERVER-ONLY: holds RESEND_API_KEY. `import "server-only"` makes an
// accidental import from a "use client" component fail the build loudly
// rather than silently bundling the key into a browser chunk — same guard
// pattern as src/lib/supabase/admin.ts. Do not remove it as a "cleanup".
//
// Resend is the transactional-email provider for everything the app itself
// sends: company-owner invites (Admin), guide invites (Studio). It is NOT
// what sends Supabase Auth's own magic-link / password-reset mail — those
// come from Supabase's mailer unless Resend is separately configured as
// custom SMTP in the Supabase dashboard (Project Settings -> Auth -> SMTP).
// If those two ever disagree about the From domain, that's the reason.

import "server-only";

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM;
const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO;

/**
 * Absolute base URL for links inside emails.
 *
 * Deliberately NOT currentOrigin() (src/lib/studio/requestOrigin.ts): that
 * derives the origin from the client-supplied Host header, which its own
 * comment flags as "never used for anything security-sensitive". Fine for a
 * QR code; a phishing vector in an email, where a spoofed Host would send a
 * genuine invite to a genuine owner carrying a link to an attacker's
 * domain. An emailed link must come from configuration, not from the
 * request that triggered it.
 *
 * Resolution order, so an invite always points at the deployment that sent
 * it — local links in dev, the branch's own URL on a preview/staging
 * deploy, the real domain in production:
 *
 *   1. APP_BASE_URL          — explicit override; the only way to name a
 *                              real custom domain, so it always wins.
 *   2. VERCEL_PROJECT_PRODUCTION_URL (when VERCEL_ENV === 'production')
 *   3. VERCEL_URL            — the per-deployment URL. This is what makes a
 *                              preview/staging build link to *itself*
 *                              instead of to production.
 *   4. http://localhost:3000 — development only.
 *
 * Every one of these is a platform-set environment variable, never a value
 * read off the incoming request, which is what keeps the guarantee above
 * intact.
 */
export function emailBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return normalizeBaseUrl(explicit);

  const vercelEnv = process.env.VERCEL_ENV;
  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelEnv === "production" && productionUrl) {
    return normalizeBaseUrl(productionUrl);
  }

  // Preview / staging deployments: link back to this exact deployment.
  const deploymentUrl = process.env.VERCEL_URL?.trim();
  if (deploymentUrl) return normalizeBaseUrl(deploymentUrl);

  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";

  throw new Error(
    "Cannot resolve a base URL for email links: APP_BASE_URL is unset and no " +
      "VERCEL_* URL is available. Refusing to fall back to the request's Host " +
      "header. Set APP_BASE_URL. See .env.example.",
  );
}

/** VERCEL_* vars carry no protocol; an operator-set APP_BASE_URL might. */
function normalizeBaseUrl(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, "");
}

/**
 * True when email is fully configured. Callers use this to degrade
 * gracefully — Admin can still surface a copy-able invite link when this is
 * false, rather than the whole company-creation flow failing because DNS
 * verification hasn't finished yet.
 */
export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY && RESEND_FROM);
}

let cached: Resend | null = null;

function resendClient(): Resend {
  if (!RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is not set. Check .env.local — this client must only " +
        "ever be constructed on the server.",
    );
  }
  cached ??= new Resend(RESEND_API_KEY);
  return cached;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative. Always supply one — see sendEmail's comment. */
  text: string;
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Sends one transactional email.
 *
 * Returns a result rather than throwing, on purpose: every current caller
 * sends mail as a *side effect* of a database write that has already
 * committed (a company row created, an invite token issued). Throwing here
 * would surface as "creating the company failed" when in fact it succeeded
 * and only the notification didn't — leaving the operator to retry and
 * create a second, duplicate company. Callers are expected to report a
 * failed send as its own recoverable condition and fall back to the
 * copy-able invite link.
 *
 * `text` is required rather than optional because a transactional email
 * with no plain-text part scores badly with spam filters, and an invite
 * that lands in spam is indistinguishable from one never sent.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      error: "Email is not configured (RESEND_API_KEY / RESEND_FROM missing).",
    };
  }

  try {
    const { data, error } = await resendClient().emails.send({
      from: RESEND_FROM as string,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(RESEND_REPLY_TO ? { replyTo: RESEND_REPLY_TO } : {}),
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data?.id) {
      return { ok: false, error: "Resend accepted the request but returned no id." };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    // Network failure, DNS, timeout — never let this escape into the
    // caller's transaction path for the reason described above.
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error sending email.",
    };
  }
}

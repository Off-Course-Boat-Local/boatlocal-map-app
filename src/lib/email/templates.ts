// Email templates. Plain HTML strings rather than React components on
// purpose: email clients (Outlook especially) support roughly 2003-era
// HTML, so these need table layouts and inline styles that JSX would only
// obscure. No CSS variables — the admin-theme.css tokens in
// src/app/admin/admin-theme.css do not exist inside an inbox; the accent
// below is PORTAL_ACCENT from src/components/MapAppMark.tsx, hardcoded here
// because that module is a Client Component and importing it server-side
// for one hex value isn't worth the coupling. If the brand accent changes,
// change it in both places.

import "server-only";

const ACCENT = "#1B5FE3";
const INK = "#1a1c22";
const INK_SOFT = "#6b7280";
const BG = "#f6f6f3";

/**
 * Escapes text interpolated into email HTML. Company names and personal
 * names are operator- and user-supplied, so they are untrusted here in
 * exactly the way any other template input is — an unescaped `<` in a
 * company name would corrupt the markup at best.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Wordmark lockup: badge image + "Map App" text.
 *
 * The text is NOT redundant with the image. Most clients block remote
 * images by default until the recipient opts in, so for a first-time
 * invite — precisely the case where nobody has whitelisted the sender yet —
 * the logo very often does not render at all. The text is what survives
 * that, and the alt attribute covers clients that show alt text in the gap.
 *
 * The image is referenced by absolute URL rather than inlined: Gmail strips
 * data: URIs on <img>, and CID attachments would make every send carry the
 * payload. It lives at public/email/map-app-logo.png.
 */
function wordmark(baseUrl: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="padding-right:10px;vertical-align:middle;">
                <img src="${baseUrl}/email/map-app-logo.png" width="28" height="28" alt="Map App"
                     style="display:block;border:0;border-radius:8px;" />
              </td>
              <td style="vertical-align:middle;font-size:16px;font-weight:600;color:${INK};">Map App</td>
            </tr></table>`;
}

function layout({
  heading,
  body,
  cta,
  baseUrl,
}: {
  heading: string;
  body: string;
  cta: string;
  baseUrl: string;
}): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px;">
            <tr>
              <td style="padding-bottom:24px;">${wordmark(baseUrl)}</td>
            </tr>
            <tr>
              <td style="font-size:20px;font-weight:600;color:${INK};padding-bottom:12px;">${heading}</td>
            </tr>
            <tr>
              <td style="font-size:14px;line-height:22px;color:${INK_SOFT};padding-bottom:24px;">${body}</td>
            </tr>
            <tr>
              <td>${cta}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:12px 20px;border-radius:8px;">${label}</a>
          <p style="font-size:12px;line-height:18px;color:${INK_SOFT};margin:20px 0 0;">
            Or paste this link into your browser:<br />
            <span style="color:${INK_SOFT};word-break:break-all;">${href}</span>
          </p>`;
}

export interface InviteEmailInput {
  /** Company this invite is for, shown so the recipient recognises it. */
  companyName: string;
  /** Absolute /join/<token> URL, from emailBaseUrl() — never the Host header. */
  inviteUrl: string;
  /**
   * Absolute origin for asset URLs, from emailBaseUrl(). Passed in rather
   * than read here so the whole template layer stays pure and testable —
   * and so a preview/staging send references its own deployment's assets.
   */
  baseUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * The email Staff send when onboarding a company's FIRST company admin
 * (createCompany's owner_invite_token). The unified Staff-managed user flow
 * uses platformUserInviteEmail below; this older template remains specific to
 * first-owner company onboarding.
 *
 * Deliberately does not mention a password: the recipient sets one at
 * /join/<token>, and telling them to "use your password" before they have
 * one is the single most common way an invite email confuses people.
 */
export function companyOwnerInviteEmail({
  companyName,
  inviteUrl,
  baseUrl,
}: InviteEmailInput): RenderedEmail {
  const safeName = escapeHtml(companyName);
  const safeUrl = escapeHtml(inviteUrl);

  return {
    subject: `Set up ${companyName} on Map App`,
    html: layout({
      baseUrl,
      heading: "You've been invited",
      body:
        `Your account for <strong style="color:${INK};">${safeName}</strong> is ready. ` +
        `Set a password and finish setting up your company — branding, your logo, ` +
        `and the recommendations your guests will see.`,
      cta: button(safeUrl, "Set up your account"),
    }),
    // Plain-text alternative — required by sendEmail(). Not decorative:
    // an email with no text/plain part is markedly more likely to be
    // filtered, and a filtered invite looks identical to one never sent.
    text: [
      "You've been invited to Map App",
      "",
      `Your account for ${companyName} is ready. Set a password and finish`,
      "setting up your company — branding, your logo, and the recommendations",
      "your guests will see.",
      "",
      inviteUrl,
    ].join("\n"),
  };
}

export interface PlatformUserInviteEmailInput {
  firstName?: string;
  roleLabel: "Staff" | "Company admin" | "Guide";
  companyName?: string;
  /** Absolute /join/<token> URL built from emailBaseUrl(). */
  inviteUrl: string;
  baseUrl: string;
}

/**
 * Staff-issued invitation from Admin > Users. This intentionally uses the
 * same wordmark, layout and CTA treatment as the existing company-owner mail
 * so recipients see one Map App invitation system even though the role/link
 * metadata is stored in a separate, generic invite record.
 */
export function platformUserInviteEmail({
  firstName,
  roleLabel,
  companyName,
  inviteUrl,
  baseUrl,
}: PlatformUserInviteEmailInput): RenderedEmail {
  const safeFirstName = firstName ? escapeHtml(firstName) : null;
  const safeRole = escapeHtml(roleLabel);
  const safeCompany = companyName ? escapeHtml(companyName) : null;
  const safeUrl = escapeHtml(inviteUrl);
  const greeting = safeFirstName ? `Hi ${safeFirstName}, ` : "";
  const scope = safeCompany ? ` for <strong style="color:${INK};">${safeCompany}</strong>` : "";

  return {
    subject: `You're invited to Map App as ${roleLabel}`,
    html: layout({
      baseUrl,
      heading: "You've been invited",
      body:
        `${greeting}you've been invited to join Map App as ` +
        `<strong style="color:${INK};">${safeRole}</strong>${scope}. ` +
        "Set your password and confirm your name to finish creating your account.",
      cta: button(safeUrl, "Accept invitation"),
    }),
    text: [
      safeFirstName ? `Hi ${firstName},` : "You've been invited to Map App",
      "",
      `You've been invited to join Map App as ${roleLabel}${companyName ? ` for ${companyName}` : ""}.`,
      "Set your password and confirm your name to finish creating your account.",
      "",
      inviteUrl,
    ].join("\n"),
  };
}

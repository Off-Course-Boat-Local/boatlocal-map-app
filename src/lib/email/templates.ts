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
  preheader,
}: {
  heading: string;
  body: string;
  cta: string;
  baseUrl: string;
  preheader?: string;
}): string {
  const preview = preheader
    ? `<span style="display:none;font-size:0px;line-height:0px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</span>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    ${preview}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <tr>
              <td style="padding-bottom:24px;">${wordmark(baseUrl)}</td>
            </tr>
            <tr>
              <td style="font-size:20px;font-weight:700;color:${INK};padding-bottom:12px;letter-spacing:-0.02em;">${heading}</td>
            </tr>
            <tr>
              <td style="font-size:14.5px;line-height:22px;color:${INK_SOFT};padding-bottom:24px;">${body}</td>
            </tr>
            <tr>
              <td>${cta}</td>
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
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-radius:8px;background:${ACCENT};">
                <a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;letter-spacing:0.01em;">${label}</a>
              </td>
            </tr>
          </table>
          <p style="font-size:12px;line-height:18px;color:${INK_SOFT};margin:20px 0 0;">
            Button not working? Paste this link into your browser:<br />
            <a href="${href}" style="color:${ACCENT};word-break:break-all;text-decoration:none;">${href}</a>
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
      preheader: `You've been invited to join Map App as ${roleLabel}. Set your password to get started.`,
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

export interface PasswordResetEmailInput {
  email: string;
  resetUrl: string;
  baseUrl: string;
}

/**
 * Branded password reset email sent when a user clicks "Forgot password?".
 */
export function passwordResetEmail({
  resetUrl,
  baseUrl,
}: PasswordResetEmailInput): RenderedEmail {
  const safeUrl = escapeHtml(resetUrl);

  return {
    subject: "Reset your Map App password",
    html: layout({
      baseUrl,
      preheader: "Reset your Map App password using this secure link.",
      heading: "Reset your password",
      body:
        "We received a request to reset the password for your Map App account. " +
        "Click the button below to choose a new password. This link is valid for 1 hour.",
      cta: button(safeUrl, "Reset password"),
    }),
    text: [
      "Reset your Map App password",
      "",
      "We received a request to reset the password for your Map App account.",
      "Click the link below to choose a new password (valid for 1 hour):",
      "",
      resetUrl,
    ].join("\n"),
  };
}

export interface SetPasswordEmailInput {
  email: string;
  setupUrl: string;
  baseUrl: string;
}

/**
 * Branded email sent when an existing user with no password enters their email to sign in.
 */
export function setPasswordEmail({
  setupUrl,
  baseUrl,
}: SetPasswordEmailInput): RenderedEmail {
  const safeUrl = escapeHtml(setupUrl);

  return {
    subject: "Set your Map App password",
    html: layout({
      baseUrl,
      preheader: "Set your password to sign in to Map App.",
      heading: "Set your password",
      body:
        "Your Map App account is active. To enable instant password sign-in on any device, " +
        "click the button below to set your password.",
      cta: button(safeUrl, "Set password"),
    }),
    text: [
      "Set your Map App password",
      "",
      "Your Map App account is active. Click the link below to set your password:",
      "",
      setupUrl,
    ].join("\n"),
  };
}

/**
 * Renders a cold-outreach email (src/lib/admin/outreachActions.ts,
 * sendOutreachEmailAction) from the admin's own composed subject/body.
 *
 * Deliberately NOT run through layout()/button() above: those render the
 * "Map App" wordmark + branded card + CTA button that every transactional
 * email (invites, notifications) uses on purpose, because the recipient
 * already has a relationship with the product. A cold email to a tour
 * operator who has never heard of Map App is the opposite case — wrapping
 * it in obvious marketing chrome is what makes a first-contact email read
 * as a mass blast and land in spam instead of like the personal note it's
 * meant to be. So this only escapes the admin's text and turns blank-line-
 * separated paragraphs into <p> tags; nothing else is added.
 */
export function plainOutreachEmail({
  subject,
  bodyText,
}: {
  subject: string;
  bodyText: string;
}): RenderedEmail {
  const html = bodyText
    .split(/\n{2,}/)
    .map((paragraph) => escapeHtml(paragraph).replace(/\n/g, "<br />"))
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:14.5px;line-height:22px;color:${INK};">${paragraph}</p>`,
    )
    .join("");

  return {
    subject,
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    ${html}
  </body>
</html>`,
    text: bodyText,
  };
}

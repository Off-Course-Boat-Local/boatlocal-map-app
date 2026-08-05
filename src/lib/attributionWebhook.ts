// Signing and verifying the boatlocal.nl booking webhook.
//
// SERVER-ONLY. This imports "node:crypto" specifically so that an accidental
// import from a "use client" component fails the Next.js build loudly,
// rather than silently shipping the shared secret to a browser bundle. Do
// not refactor this file to avoid that import as a "cleanup."
//
// Scheme is Stripe-style: HMAC-SHA256 over `${timestamp}.${rawBody}`, with
// the timestamp itself checked against a tolerance window. Signing over the
// raw body (not a re-serialized object) matters — JSON.stringify can reorder
// keys or change whitespace, which would make a naive "verify by
// re-signing the parsed object" scheme reject genuine requests. Always
// verify against the exact bytes that were received.

import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-boatlocal-signature";
export const TIMESTAMP_HEADER = "x-boatlocal-timestamp";

/** How old a signed request may be before we reject it as a replay. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

function hmacHex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

/**
 * Produces the header value BoatLocal's side should send. Exported mainly so
 * our own tests (and a local "simulate BoatLocal calling us" preview script)
 * can construct valid requests without duplicating the scheme.
 */
export function signWebhookBody(
  rawBody: string,
  secret: string,
  timestampSeconds: number,
): string {
  return `sha256=${hmacHex(secret, `${timestampSeconds}.${rawBody}`)}`;
}

export interface VerifyWebhookInput {
  rawBody: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
  secret: string;
  /** Injectable for tests; defaults to the real clock. */
  now?: () => number;
  toleranceSeconds?: number;
}

export type VerifyWebhookResult =
  | { ok: true }
  | { ok: false; reason: "missing-headers" | "bad-timestamp" | "stale" | "bad-signature" };

/**
 * Every failure reason is distinct on purpose — "the header was missing" and
 * "the signature didn't match" want different log lines and different
 * responses to whoever's debugging a broken integration on BoatLocal's side.
 */
export function verifyWebhookSignature({
  rawBody,
  signatureHeader,
  timestampHeader,
  secret,
  now = Date.now,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
}: VerifyWebhookInput): VerifyWebhookResult {
  if (!signatureHeader || !timestampHeader) {
    return { ok: false, reason: "missing-headers" };
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, reason: "bad-timestamp" };
  }

  const ageSeconds = Math.abs(now() / 1000 - timestamp);
  if (ageSeconds > toleranceSeconds) {
    return { ok: false, reason: "stale" };
  }

  const expected = signWebhookBody(rawBody, secret, timestamp);

  // Constant-time comparison. A straight `===` on the hex strings leaks
  // timing information about how many leading bytes matched, which is
  // exactly the side channel HMAC verification exists to avoid.
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  const signaturesMatch =
    expectedBuf.length === actualBuf.length &&
    timingSafeEqual(expectedBuf, actualBuf);

  if (!signaturesMatch) {
    return { ok: false, reason: "bad-signature" };
  }

  return { ok: true };
}

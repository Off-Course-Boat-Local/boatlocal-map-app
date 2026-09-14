// Verification for Resend inbound webhooks.
// Resend uses Svix standard signatures:
// svix-id, svix-timestamp, svix-signature.
// Secret starts with 'whsec_' and is base64-encoded.

import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerifyResendWebhookInput {
  rawBody: string;
  headers: {
    id: string | null;
    timestamp: string | null;
    signature: string | null;
  };
  secret: string;
}

export function verifyResendWebhook({
  rawBody,
  headers,
  secret,
}: VerifyResendWebhookInput): boolean {
  if (!headers.id || !headers.timestamp || !headers.signature) {
    return false;
  }

  // Svix secret stripping
  const cleanSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const secretBytes = Buffer.from(cleanSecret, "base64");

  const toSign = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const computedSignature = createHmac("sha256", secretBytes)
    .update(toSign)
    .digest("base64");

  // Svix signature header format: "v1,signature1 v1,signature2"
  const passedSignatures = headers.signature
    .split(" ")
    .map((part) => part.trim().replace(/^v1,/, ""));

  return passedSignatures.some((sig) => {
    try {
      const sigBuf = Buffer.from(sig, "base64");
      const compBuf = Buffer.from(computedSignature, "base64");
      return sigBuf.length === compBuf.length && timingSafeEqual(sigBuf, compBuf);
    } catch {
      return false;
    }
  });
}

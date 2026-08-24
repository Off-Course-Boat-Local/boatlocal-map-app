import "server-only";

import { createHash, randomBytes } from "node:crypto";

export function createUserInviteToken(): string {
  return `usr_${randomBytes(32).toString("base64url")}`;
}

export function hashUserInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

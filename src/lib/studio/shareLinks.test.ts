import { describe, expect, it } from "vitest";

import { buildCompanyShareUrl, buildGuideShareUrl, buildInviteUrl } from "./shareLinks";

const ORIGIN = "https://studio.example.com";

describe("buildGuideShareUrl", () => {
  it("carries both company and guide as query params on the bare origin", () => {
    expect(buildGuideShareUrl({ origin: ORIGIN, companyId: "coastal", guideSlug: "jan" })).toBe(
      `${ORIGIN}/?company=coastal&guide=jan`,
    );
  });
});

describe("buildCompanyShareUrl", () => {
  it("carries only the company, never a guide param", () => {
    const url = buildCompanyShareUrl({ origin: ORIGIN, companyId: "coastal" });
    expect(url).toBe(`${ORIGIN}/?company=coastal`);
    expect(url).not.toContain("guide=");
  });
});

describe("buildInviteUrl", () => {
  it("points at the (non-gated) join route with the token as the last path segment", () => {
    expect(buildInviteUrl({ origin: ORIGIN, token: "inv_abc123" })).toBe(
      `${ORIGIN}/join/inv_abc123`,
    );
  });
});

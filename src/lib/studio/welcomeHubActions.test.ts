import { beforeEach, describe, expect, it, vi } from "vitest";

import { getWelcomeHub, resetFakeWelcomeHubStore } from "@/lib/data/welcomeHub";
import { createDefaultBlock } from "@/lib/welcome-blocks/registry";
import {
  cloneCompanyHubToGuideAction,
  resetGuideHubAction,
  saveWelcomeHubAction,
} from "./welcomeHubActions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let session: unknown = null;
vi.mock("./devAuth", () => ({
  getDevSession: async () => session,
  actorFromSession: (s: { role: string; companyId: string; guideId?: string }) =>
    s.role === "guide"
      ? { role: "guide", companyId: s.companyId, guideId: s.guideId }
      : { role: "company", companyId: s.companyId },
}));
vi.mock("@/lib/data/source", () => ({
  getGuidesForCompany: async (_a: unknown, companyId: string) =>
    companyId === "co-1" ? [{ id: "g-1" }, { id: "g-2" }] : [],
}));

const company = { role: "company", email: "o@x.nl", companyId: "co-1", companyName: "Co" };
const tip = () => createDefaultBlock("tip_box");

beforeEach(() => {
  resetFakeWelcomeHubStore();
  session = company;
});

describe("saveWelcomeHubAction", () => {
  it("saves company-default blocks with sequential order", async () => {
    const res = await saveWelcomeHubAction(null, [tip(), createDefaultBlock("paragraph")]);
    expect(res).toEqual({ ok: true });
    const hub = await getWelcomeHub("co-1", null, { exact: true });
    expect(hub?.blocks?.map((b) => [b.type, b.displayOrder])).toEqual([
      ["tip_box", 0],
      ["paragraph", 1],
    ]);
  });

  it("rejects signed-out callers and guides", async () => {
    session = null;
    expect((await saveWelcomeHubAction(null, [])).error).toMatch(/not signed in/i);
    session = { role: "guide", email: "g@x.nl", companyId: "co-1", companyName: "Co", guideId: "g-1", guideName: "G" };
    expect((await saveWelcomeHubAction("g-1", [])).error).toMatch(/company owner/i);
  });

  it("rejects a guide id from another company", async () => {
    expect((await saveWelcomeHubAction("g-other", [tip()])).error).toBe("Unknown guide.");
    expect(await getWelcomeHub("co-1", "g-other", { exact: true })).toBeNull();
  });

  it("rejects unknown types, javascript: links and oversize lists", async () => {
    expect((await saveWelcomeHubAction(null, [{ type: "evil", content: {} }])).error).toMatch(/unknown type/);
    const cta = { ...createDefaultBlock("cta_banner"), content: { label: "x", href: "javascript:alert(1)" } };
    expect((await saveWelcomeHubAction(null, [cta])).error).toMatch(/http/);
    expect((await saveWelcomeHubAction(null, Array.from({ length: 51 }, tip))).error).toMatch(/at most/);
  });

  it("drops non-http review URLs", async () => {
    const review = {
      ...createDefaultBlock("review_card"),
      content: { platforms: ["google"], urls: { google: "https://g.page/r/abc", tripadvisor: "javascript:1" } },
    };
    await saveWelcomeHubAction(null, [review]);
    const hub = await getWelcomeHub("co-1", null, { exact: true });
    expect((hub?.blocks?.[0].content as { urls: object }).urls).toEqual({ google: "https://g.page/r/abc" });
  });
});

describe("clone and reset", () => {
  it("copies the company template to a guide, then reset removes the guide override", async () => {
    await saveWelcomeHubAction(null, [tip()]);
    expect(await cloneCompanyHubToGuideAction("g-1")).toEqual({ ok: true });
    expect((await getWelcomeHub("co-1", "g-1", { exact: true }))?.blocks).toHaveLength(1);

    expect(await resetGuideHubAction("g-1")).toEqual({ ok: true });
    expect(await getWelcomeHub("co-1", "g-1", { exact: true })).toBeNull();
  });

  it("refuses clone/reset for guides outside the company", async () => {
    expect((await cloneCompanyHubToGuideAction("g-other")).error).toBe("Unknown guide.");
    expect((await resetGuideHubAction("g-other")).error).toBe("Unknown guide.");
  });
});

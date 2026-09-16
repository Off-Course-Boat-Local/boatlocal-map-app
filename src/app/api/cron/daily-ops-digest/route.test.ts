import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const getDailyOpsDigestData = vi.fn();
const formatDailyOpsDigestSlackMessage = vi.fn();
const isOpsSlackConfigured = vi.fn();
const postToOpsSlack = vi.fn();

vi.mock("@/lib/ops/dailyDigest", () => ({
  getDailyOpsDigestData,
  formatDailyOpsDigestSlackMessage,
}));

vi.mock("@/lib/slack/client", () => ({
  isOpsSlackConfigured,
  postToOpsSlack,
}));

const { GET } = await import("./route");

describe("GET /api/cron/daily-ops-digest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("rejects unauthorized calls", async () => {
    const req = new Request("http://localhost/api/cron/daily-ops-digest", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("posts message to ops slack when configured", async () => {
    getDailyOpsDigestData.mockResolvedValue({
      dateLabel: "Tuesday, Sep 15, 2026",
      prospectActivities: [{ prospectId: "1" }],
      companyChanges: [],
    });
    formatDailyOpsDigestSlackMessage.mockReturnValue("Test slack message");
    isOpsSlackConfigured.mockReturnValue(true);
    postToOpsSlack.mockResolvedValue({ ok: true });

    const req = new Request("http://localhost/api/cron/daily-ops-digest", {
      headers: { authorization: "Bearer test-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.posted).toBe(true);
    expect(postToOpsSlack).toHaveBeenCalledWith("Test slack message");
  });
});

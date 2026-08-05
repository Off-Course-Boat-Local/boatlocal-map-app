import { describe, expect, it } from "vitest";

import { parseDateRangeParams } from "./dateRange";

describe("parseDateRangeParams", () => {
  it("returns undefined when neither bound is given", () => {
    expect(parseDateRangeParams({})).toBeUndefined();
  });

  it("returns undefined when both bounds fail to parse", () => {
    expect(parseDateRangeParams({ from: "not-a-date", to: "also-not-a-date" })).toBeUndefined();
  });

  it("builds a range from a valid from/to pair, pushing `to` to the start of the next day", () => {
    const range = parseDateRangeParams({ from: "2026-01-01", to: "2026-01-31" });
    expect(range).toBeDefined();
    expect(range!.from.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(range!.to.toISOString().slice(0, 10)).toBe("2026-02-01");
  });

  it("falls back to the epoch when only `to` is given", () => {
    const range = parseDateRangeParams({ to: "2026-01-15" });
    expect(range).toBeDefined();
    expect(range!.from.getTime()).toBe(0);
    expect(range!.to.toISOString().slice(0, 10)).toBe("2026-01-16");
  });

  it("falls back to an open upper bound when only `from` is given", () => {
    const range = parseDateRangeParams({ from: "2026-01-01" });
    expect(range).toBeDefined();
    expect(range!.from.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(range!.to.getTime()).toBeGreaterThan(Date.now());
  });

  it("drops an invalid bound but keeps the valid one", () => {
    const range = parseDateRangeParams({ from: "garbage", to: "2026-01-15" });
    expect(range).toBeDefined();
    expect(range!.from.getTime()).toBe(0);
    expect(range!.to.toISOString().slice(0, 10)).toBe("2026-01-16");
  });
});

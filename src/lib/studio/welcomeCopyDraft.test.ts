import { beforeEach, describe, expect, it } from "vitest";

import { getWelcomeCopyDraft, setWelcomeCopyDraft } from "./welcomeCopyDraft";

beforeEach(() => {
  window.localStorage.clear();
});

describe("welcomeCopyDraft", () => {
  it("returns an empty string when nothing has been saved", () => {
    expect(getWelcomeCopyDraft("company-1")).toBe("");
  });

  it("round-trips a saved draft", () => {
    setWelcomeCopyDraft("company-1", "Welcome aboard!");
    expect(getWelcomeCopyDraft("company-1")).toBe("Welcome aboard!");
  });

  it("keeps drafts for different companies separate", () => {
    setWelcomeCopyDraft("company-1", "Hi from company 1");
    setWelcomeCopyDraft("company-2", "Hi from company 2");

    expect(getWelcomeCopyDraft("company-1")).toBe("Hi from company 1");
    expect(getWelcomeCopyDraft("company-2")).toBe("Hi from company 2");
  });

  it("clears the key when saving an empty (or whitespace-only) string", () => {
    setWelcomeCopyDraft("company-1", "Something");
    setWelcomeCopyDraft("company-1", "   ");
    expect(getWelcomeCopyDraft("company-1")).toBe("");
    expect(window.localStorage.getItem("boatlocal:studio:welcome-copy-draft:v1:company-1")).toBeNull();
  });
});

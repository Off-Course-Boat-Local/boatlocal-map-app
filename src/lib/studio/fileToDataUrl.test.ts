import { describe, expect, it } from "vitest";

import { InvalidLogoFileError, MAX_LOGO_FILE_BYTES, fileToDataUrl } from "./fileToDataUrl";

describe("fileToDataUrl", () => {
  it("resolves a PNG file to a data URL", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "logo.png", { type: "image/png" });
    const url = await fileToDataUrl(file);
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("resolves an SVG file to a data URL", async () => {
    const file = new File(["<svg></svg>"], "logo.svg", { type: "image/svg+xml" });
    const url = await fileToDataUrl(file);
    expect(url.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("rejects a disallowed file type", async () => {
    const file = new File(["hi"], "logo.gif", { type: "image/gif" });
    await expect(fileToDataUrl(file)).rejects.toBeInstanceOf(InvalidLogoFileError);
  });

  it("rejects a file over the size cap", async () => {
    const big = new Uint8Array(MAX_LOGO_FILE_BYTES + 1);
    const file = new File([big], "logo.png", { type: "image/png" });
    await expect(fileToDataUrl(file)).rejects.toBeInstanceOf(InvalidLogoFileError);
  });
});

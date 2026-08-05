import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BRANDS } from "@/lib/brand";

import BrandingForm from "./BrandingForm";
import { StudioPreviewProvider, useStudioPreview } from "./StudioPreviewContext";

const saveCompanyBrandingAction = vi.fn();
vi.mock("@/lib/studio/brandingActions", () => ({
  saveCompanyBrandingAction: (...args: unknown[]) => saveCompanyBrandingAction(...args),
}));

const initialBrand = BRANDS.coastal;
const companyId = "company-1";

/** Exposes the live preview's current brand/logo so tests can assert the wiring, not just the form's own inputs. */
function PreviewProbe() {
  const { brand, logoUrl } = useStudioPreview();
  return (
    <div>
      <p data-testid="preview-app-name">{brand.appName}</p>
      <p data-testid="preview-primary">{brand.primary}</p>
      <p data-testid="preview-logo">{logoUrl ?? "none"}</p>
    </div>
  );
}

function renderForm(initialLogoUrl: string | null = null) {
  return render(
    <StudioPreviewProvider initialBrand={initialBrand} initialLogoUrl={initialLogoUrl}>
      <BrandingForm companyId={companyId} initialBrand={initialBrand} initialLogoUrl={initialLogoUrl} />
      <PreviewProbe />
    </StudioPreviewProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  saveCompanyBrandingAction.mockReset();
  saveCompanyBrandingAction.mockResolvedValue({});
});

describe("BrandingForm", () => {
  it("renders the saved app name and colours", () => {
    renderForm();
    expect(screen.getByLabelText("App name")).toHaveValue(initialBrand.appName);
    expect(screen.getByLabelText("Primary colour")).toHaveValue(initialBrand.primary);
    expect(screen.getByLabelText("Accent colour")).toHaveValue(initialBrand.accent);
  });

  it("updates the live preview as the app name is typed", async () => {
    renderForm();
    const input = screen.getByLabelText("App name");
    await userEvent.clear(input);
    await userEvent.type(input, "Jan's Rotterdam");
    expect(screen.getByTestId("preview-app-name")).toHaveTextContent("Jan's Rotterdam");
  });

  it("updates the live preview when a colour preset is picked", async () => {
    renderForm();
    const coral = BRANDS.coral;
    await userEvent.click(
      screen.getByRole("button", { name: `Use ${coral.companyName}'s primary colour (${coral.primary})` }),
    );
    expect(screen.getByLabelText("Primary colour")).toHaveValue(coral.primary);
    expect(screen.getByTestId("preview-primary")).toHaveTextContent(coral.primary);
  });

  it("flags an invalid hex colour instead of accepting it silently", async () => {
    renderForm();
    const primaryInput = screen.getByLabelText("Primary colour");
    await userEvent.clear(primaryInput);
    await userEvent.type(primaryInput, "notahex");
    expect(screen.getByText(/enter a hex colour/i)).toBeInTheDocument();
  });

  it("blocks Save while a colour field is invalid", async () => {
    renderForm();
    const primaryInput = screen.getByLabelText("Primary colour");
    await userEvent.clear(primaryInput);
    await userEvent.type(primaryInput, "notahex");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(saveCompanyBrandingAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/fix the highlighted colour/i);
  });

  it("saves app name and colours through saveCompanyBrandingAction on Save", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(saveCompanyBrandingAction).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        appName: initialBrand.appName,
        brandPrimary: initialBrand.primary,
        brandPrimaryDark: initialBrand.primaryDark,
        brandAccent: initialBrand.accent,
        logoUrl: null,
      }),
    );
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("shows the server's error message when the save action rejects", async () => {
    saveCompanyBrandingAction.mockRejectedValueOnce(new Error("Only a company account can edit branding."));
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only a company account can edit branding.",
    );
  });

  it("persists welcome copy to localStorage on Save, not through the server action", async () => {
    renderForm();
    const textarea = screen.getByLabelText("Welcome copy");
    await userEvent.type(textarea, "Welcome aboard!");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Saved.");
    expect(
      window.localStorage.getItem(`boatlocal:studio:welcome-copy-draft:v1:${companyId}`),
    ).toBe("Welcome aboard!");
    expect(saveCompanyBrandingAction).toHaveBeenCalledWith(
      companyId,
      expect.not.objectContaining({ welcomeCopy: expect.anything() }),
    );
  });

  it("restores saved values and clears the live preview override on Discard changes", async () => {
    renderForm();
    const input = screen.getByLabelText("App name");
    await userEvent.clear(input);
    await userEvent.type(input, "Something else entirely");
    expect(screen.getByTestId("preview-app-name")).toHaveTextContent("Something else entirely");

    await userEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(screen.getByLabelText("App name")).toHaveValue(initialBrand.appName);
    expect(screen.getByTestId("preview-app-name")).toHaveTextContent(initialBrand.appName);
  });

  it("rejects a disallowed logo file type with a friendly message", async () => {
    renderForm();
    const file = new File(["gif-bytes"], "logo.gif", { type: "image/gif" });
    const input = screen.getByLabelText("Upload logo", { selector: "input" });
    // fireEvent.change, not userEvent.upload: userEvent.upload faithfully
    // simulates a real OS file picker restricted by the input's `accept`
    // attribute, which would silently exclude a .gif before it ever reaches
    // our onChange — exactly the browser behaviour that makes this
    // component-level check a defence-in-depth backstop (e.g. a browser
    // that doesn't enforce `accept`), not the primary line of defence.
    // fileToDataUrl's own rejection is unit-tested directly in
    // fileToDataUrl.test.ts; this test is about the component wiring it up.
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/png or svg/i);
    expect(screen.getByTestId("preview-logo")).toHaveTextContent("none");
  });

  it("accepts a PNG logo and reflects it in the live preview", async () => {
    renderForm();
    const file = new File([new Uint8Array([1, 2, 3])], "logo.png", { type: "image/png" });
    const input = screen.getByLabelText("Upload logo", { selector: "input" });
    await userEvent.upload(input, file);

    expect(await screen.findByAltText("Company logo preview")).toBeInTheDocument();
    expect(screen.getByTestId("preview-logo")).not.toHaveTextContent("none");
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultBlock } from "@/lib/welcome-blocks/registry";
import WelcomeHubEditor from "./WelcomeHubEditor";

const save = vi.fn();
vi.mock("@/lib/studio/welcomeHubActions", () => ({
  saveWelcomeHubAction: (...a: unknown[]) => save(...a),
  cloneCompanyHubToGuideAction: vi.fn(),
  resetGuideHubAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const base = {
  guideId: null,
  guides: [{ id: "g-1", name: "Sergio" }],
  places: [{ id: "p1", name: "Bistro Berlage" }],
  hasOwnHub: false,
};

beforeEach(() => save.mockReset().mockResolvedValue({ ok: true }));

describe("WelcomeHubEditor", () => {
  it("keeps Save disabled until something changes, then saves the edited blocks", async () => {
    const user = userEvent.setup();
    render(<WelcomeHubEditor {...base} initialBlocks={[createDefaultBlock("tip_box", 0)]} />);
    const saveBtn = screen.getByRole("button", { name: /save blocks/i });
    expect(saveBtn).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /add block/i }));
    await user.click(screen.getByRole("button", { name: /Gids Introductie/ }));
    expect(saveBtn).toBeEnabled();

    await user.click(saveBtn);
    expect(save).toHaveBeenCalledTimes(1);
    const [guideId, blocks] = save.mock.calls[0];
    expect(guideId).toBeNull();
    expect(blocks.map((b: { type: string }) => b.type)).toEqual(["tip_box", "guide_hero"]);
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("reorders and deletes blocks", async () => {
    const user = userEvent.setup();
    render(
      <WelcomeHubEditor
        {...base}
        initialBlocks={[createDefaultBlock("tip_box", 0), createDefaultBlock("paragraph", 1)]}
      />,
    );
    await user.click(screen.getAllByRole("button", { name: "Move up" })[1]);
    await user.click(screen.getAllByRole("button", { name: "Delete block" })[1]);
    await user.click(screen.getByRole("button", { name: /save blocks/i }));
    expect(save.mock.calls[0][1].map((b: { type: string }) => b.type)).toEqual(["paragraph"]);
  });

  it("offers the company template copy for a guide without their own hub", () => {
    render(<WelcomeHubEditor {...base} guideId="g-1" initialBlocks={[]} />);
    expect(screen.getByRole("button", { name: /kopieer van company template/i })).toBeInTheDocument();
    expect(screen.getByText("Using company default")).toBeInTheDocument();
  });
});

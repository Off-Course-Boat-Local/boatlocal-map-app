import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import Pin from "./Pin";
import { CATEGORY_MAP } from "@/lib/categories";

describe("Pin", () => {
  it("renders as a button labelled with the place name", () => {
    render(<Pin category="boats" label="Amsterdam Boat Tour" />);
    expect(
      screen.getByRole("button", { name: "Amsterdam Boat Tour" }),
    ).toBeInTheDocument();
  });

  it("falls back to the category label when no label is given", () => {
    render(<Pin category="boats" />);
    expect(
      screen.getByRole("button", { name: CATEGORY_MAP.boats.label }),
    ).toBeInTheDocument();
  });

  it("calls onClick when tapped", async () => {
    const onClick = vi.fn();
    render(<Pin category="lunch" label="Lunch spot" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Lunch spot" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("reflects selection via aria-pressed", () => {
    const { rerender } = render(<Pin category="boats" label="Tour" selected={false} />);
    expect(screen.getByRole("button", { name: "Tour" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    rerender(<Pin category="boats" label="Tour" selected />);
    expect(screen.getByRole("button", { name: "Tour" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("only mounts the pulsing selection ring while selected", () => {
    const { container, rerender } = render(
      <Pin category="boats" label="Tour" selected={false} />,
    );
    expect(container.querySelector(".animate-ping")).not.toBeInTheDocument();

    rerender(<Pin category="boats" label="Tour" selected />);
    expect(container.querySelector(".animate-ping")).toBeInTheDocument();
  });

  it("colours the selection ring with the brand token, not the category colour", () => {
    const { container } = render(<Pin category="boats" label="Tour" selected />);
    const ring = container.querySelector(".animate-ping") as HTMLElement | null;
    expect(ring).not.toBeNull();
    expect(ring?.style.background).toBe("var(--brand-primary)");
  });

  it("renders as a non-interactive, labelled image when interactive=false", () => {
    render(<Pin category="shop" label="Static pin" interactive={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Static pin" })).toBeInTheDocument();
  });
});

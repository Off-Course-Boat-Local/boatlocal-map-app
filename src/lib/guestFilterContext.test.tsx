import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { GuestFilterProvider, useGuestFilter } from "./guestFilterContext";

function FilterReader({ testId }: { testId: string }) {
  const { filter, setFilter } = useGuestFilter();
  return (
    <div>
      <span data-testid={testId}>{filter ?? "all"}</span>
      <button type="button" onClick={() => setFilter("coffee")}>
        set-{testId}
      </button>
    </div>
  );
}

describe("useGuestFilter", () => {
  it("defaults to 'All' (null)", () => {
    render(
      <GuestFilterProvider>
        <FilterReader testId="a" />
      </GuestFilterProvider>,
    );
    expect(screen.getByTestId("a")).toHaveTextContent("all");
  });

  it("shares filter state between two consumers under the same provider", async () => {
    render(
      <GuestFilterProvider>
        <FilterReader testId="a" />
        <FilterReader testId="b" />
      </GuestFilterProvider>,
    );

    await userEvent.click(screen.getByText("set-a"));

    expect(screen.getByTestId("a")).toHaveTextContent("coffee");
    expect(screen.getByTestId("b")).toHaveTextContent("coffee");
  });

  it("falls back to independent local state outside a provider", async () => {
    render(
      <>
        <FilterReader testId="a" />
        <FilterReader testId="b" />
      </>,
    );

    await userEvent.click(screen.getByText("set-a"));

    expect(screen.getByTestId("a")).toHaveTextContent("coffee");
    expect(screen.getByTestId("b")).toHaveTextContent("all");
  });
});

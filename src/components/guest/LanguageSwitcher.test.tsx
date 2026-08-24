import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageSwitcher } from "./LanguageSwitcher";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { LOCALE_COOKIE } from "@/lib/i18n/locales";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

beforeEach(() => {
  refresh.mockClear();
  // jsdom cookies persist between tests; clear ours.
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`;
});

describe("LanguageSwitcher", () => {
  it("shows the current locale code on the pill (EN without a provider)", () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole("button", { name: /language/i })).toHaveTextContent("EN");
  });

  it("lists every supported language by its native name (with flags) when opened", async () => {
    render(<LanguageSwitcher />);

    await userEvent.click(screen.getByRole("button", { name: /language/i }));

    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "🇬🇧English",
      "🇳🇱Nederlands",
      "🇩🇪Deutsch",
      "🇪🇸Español",
      "🇫🇷Français",
    ]);
    // The current locale (en, from the no-provider default) is marked.
    expect(screen.getByRole("option", { name: "English" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("option", { name: "Nederlands" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("writes the map_app_lang cookie and refreshes the router on select", async () => {
    render(<LanguageSwitcher />);

    await userEvent.click(screen.getByRole("button", { name: /language/i }));
    await userEvent.click(screen.getByRole("option", { name: "Nederlands" }));

    expect(document.cookie).toContain(`${LOCALE_COOKIE}=nl`);
    expect(refresh).toHaveBeenCalledTimes(1);
    // Dropdown closes after selecting.
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("reflects the provider's locale on the pill and checkmark", async () => {
    render(
      <LocaleProvider locale="de">
        <LanguageSwitcher />
      </LocaleProvider>,
    );

    const trigger = screen.getByRole("button", { name: /sprache/i });
    expect(trigger).toHaveTextContent("DE");

    await userEvent.click(trigger);
    expect(screen.getByRole("option", { name: "Deutsch" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("does not rewrite the cookie or refresh when re-selecting the current language", async () => {
    render(<LanguageSwitcher />);

    await userEvent.click(screen.getByRole("button", { name: /language/i }));
    await userEvent.click(screen.getByRole("option", { name: "English" }));

    expect(refresh).not.toHaveBeenCalled();
  });
});

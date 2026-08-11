import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { LanguageSwitcher } from "./LanguageSwitcher";

// usePathname() needs a real Next.js router context, which isn't present
// under jsdom/RTL — mocked to a fixed path, as if rendered on the dashboard.
vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return { ...actual, usePathname: () => "/" };
});

const renderSwitcher = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LanguageSwitcher />
    </NextIntlClientProvider>,
  );

describe("LanguageSwitcher", () => {
  it("shows the active locale as plain text and the other as a link to the same page", () => {
    renderSwitcher();

    const active = screen.getByText("English");
    expect(active).toHaveAttribute("aria-current", "true");
    expect(active.tagName).not.toBe("A");

    const other = screen.getByRole("link", { name: "Українська" });
    expect(other).toHaveAttribute("href", "/uk");
  });
});

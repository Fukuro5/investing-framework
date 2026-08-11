import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { Nav } from "./Nav";

// Nav renders LanguageSwitcher, which calls usePathname() — needs a real
// Next.js router context that isn't present under jsdom/RTL.
vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return { ...actual, usePathname: () => "/" };
});

const renderNav = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Nav />
    </NextIntlClientProvider>,
  );

describe("Nav", () => {
  it("renders the app name and both nav links", () => {
    renderNav();

    expect(screen.getByText("Investing Framework")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/en");
    expect(screen.getByRole("link", { name: "Import" })).toHaveAttribute("href", "/en/import");
  });

  it("renders the language switcher with the active locale highlighted", () => {
    renderNav();

    expect(screen.getByText("English")).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Українська" })).toBeInTheDocument();
  });
});

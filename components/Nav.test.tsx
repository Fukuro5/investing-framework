import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import { Nav } from "./Nav";

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
});

import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import { FrameworkSwitcher } from "./FrameworkSwitcher";

const renderSwitcher = (props: Parameters<typeof FrameworkSwitcher>[0]) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FrameworkSwitcher {...props} />
    </NextIntlClientProvider>,
  );

describe("FrameworkSwitcher", () => {
  it("shows a message and a manage link when there are no frameworks", () => {
    renderSwitcher({ frameworks: [], activeFrameworkId: null });

    expect(screen.getByText("No frameworks yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage frameworks" })).toHaveAttribute("href", "/en/frameworks");
  });

  it("lists frameworks in a select, defaulting to the active one", () => {
    renderSwitcher({
      frameworks: [
        { id: "a", name: "Quality" },
        { id: "b", name: "Momentum" },
      ],
      activeFrameworkId: "b",
    });

    expect(screen.getByRole("combobox")).toHaveValue("b");
    expect(screen.getByRole("option", { name: "Quality" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set active" })).toBeInTheDocument();
  });
});

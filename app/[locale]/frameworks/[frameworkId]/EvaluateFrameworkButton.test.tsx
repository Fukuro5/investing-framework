import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import { EvaluateFrameworkButton } from "./EvaluateFrameworkButton";

describe("EvaluateFrameworkButton", () => {
  it("renders a submit button carrying the frameworkId as a hidden field", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <EvaluateFrameworkButton frameworkId="framework-1" />
      </NextIntlClientProvider>,
    );

    const button = screen.getByRole("button", { name: "Recompute" });
    const form = button.closest("form");
    expect(form?.querySelector('input[name="frameworkId"]')).toHaveValue("framework-1");
  });
});

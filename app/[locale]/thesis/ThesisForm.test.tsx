import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import { ThesisForm } from "./ThesisForm";

describe("ThesisForm", () => {
  it("renders the content field pre-filled and carrying the instrumentId", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ThesisForm instrumentId="instrument-1" initialContent="Durable moat." />
      </NextIntlClientProvider>,
    );

    expect(screen.getByLabelText("Thesis")).toHaveValue("Durable moat.");
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.closest("form")?.querySelector('input[name="instrumentId"]')).toHaveValue("instrument-1");
  });
});

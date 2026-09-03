import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import { EdgarCheckButton } from "./EdgarCheckButton";

describe("EdgarCheckButton", () => {
  it("shows 'never checked' and carries the instrumentId when nothing has been checked yet", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <EdgarCheckButton
          instrumentId="instrument-1"
          initialStatus={{ lastCheckedFilingDate: null, verdict: null, thesisVerdict: null, thesisExplanation: null }}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(messages.thesisPage.edgarNeverChecked)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: messages.thesisPage.edgarCheckButton });
    expect(button.closest("form")?.querySelector('input[name="instrumentId"]')).toHaveValue("instrument-1");
  });

  it("shows the last-checked date and verdict when already checked before", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <EdgarCheckButton
          instrumentId="instrument-1"
          initialStatus={{ lastCheckedFilingDate: new Date("2026-07-31"), verdict: "improving", thesisVerdict: null, thesisExplanation: null }}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(messages.thesisPage.edgarVerdictImproving)).toBeInTheDocument();
    expect(screen.queryByText(messages.thesisPage.edgarNeverChecked)).not.toBeInTheDocument();
  });

  it("shows the thesis verdict and explanation from a prior check", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <EdgarCheckButton
          instrumentId="instrument-1"
          initialStatus={{
            lastCheckedFilingDate: new Date("2026-07-31"),
            verdict: "improving",
            thesisVerdict: "partiallyWeakening",
            thesisExplanation: "Margins compressed slightly.",
          }}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(messages.thesisPage.thesisVerdictPartiallyWeakening)).toBeInTheDocument();
    expect(screen.getByText("Margins compressed slightly.")).toBeInTheDocument();
  });
});

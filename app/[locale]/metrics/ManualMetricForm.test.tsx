import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import { ManualMetricForm } from "./ManualMetricForm";

describe("ManualMetricForm", () => {
  it("renders metric key, value, and asOfDate fields carrying the instrumentId", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ManualMetricForm instrumentId="instrument-1" />
      </NextIntlClientProvider>,
    );

    expect(screen.getByLabelText("Metric key")).toHaveValue("");
    expect(screen.getByLabelText("Value")).toHaveValue(null);
    expect(screen.getByLabelText("As of date")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.closest("form")?.querySelector('input[name="instrumentId"]')).toHaveValue("instrument-1");
  });
});

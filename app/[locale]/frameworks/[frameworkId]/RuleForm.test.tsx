import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { FormState } from "./actions";
import { RuleForm } from "./RuleForm";

describe("RuleForm", () => {
  it("renders empty fields and no active checkbox for create mode", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RuleForm
          action={vi.fn(async (): Promise<FormState> => ({ status: "idle" }))}
          hiddenFields={{ groupId: "group-1" }}
          submitLabel="Add rule"
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByLabelText("Metric key")).toHaveValue("");
    expect(screen.queryByLabelText("Active")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add rule" })).toBeInTheDocument();
  });

  it("pre-fills fields and shows the active checkbox for edit mode", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RuleForm
          action={vi.fn(async (): Promise<FormState> => ({ status: "idle" }))}
          hiddenFields={{ ruleId: "rule-1" }}
          defaultValues={{ metricKey: "roic", operator: "gt", threshold: 15, isActive: true }}
          submitLabel="Save"
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByLabelText("Metric key")).toHaveValue("roic");
    expect(screen.getByLabelText("Threshold")).toHaveValue(15);
    expect(screen.getByLabelText("Active")).toBeChecked();
  });
});

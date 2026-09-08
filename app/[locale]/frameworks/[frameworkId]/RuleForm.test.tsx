import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { FormState } from "./actions";
import { RuleForm } from "./RuleForm";

describe("RuleForm", () => {
  it("renders empty metric fields and no active checkbox for create mode", () => {
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

  it("switches to allocation fields when the rule type is changed", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RuleForm
          action={vi.fn(async (): Promise<FormState> => ({ status: "idle" }))}
          hiddenFields={{ groupId: "group-1" }}
          submitLabel="Add rule"
        />
      </NextIntlClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("Rule type"), { target: { value: "allocation" } });

    expect(screen.queryByLabelText("Metric key")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Min % per position")).toBeInTheDocument();
    expect(screen.getByLabelText("Max % per position")).toBeInTheDocument();
  });

  it("pre-fills fields and shows the active checkbox for a metric rule in edit mode", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RuleForm
          action={vi.fn(async (): Promise<FormState> => ({ status: "idle" }))}
          hiddenFields={{ ruleId: "rule-1" }}
          defaultValues={{
            type: "metric",
            metricKey: "roic",
            operator: "gt",
            threshold: 15,
            role: "classification",
            minAllocation: null,
            maxAllocation: null,
            isActive: true,
          }}
          submitLabel="Save"
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByLabelText("Metric key")).toHaveValue("roic");
    expect(screen.getByLabelText("Threshold")).toHaveValue(15);
    expect(screen.getByLabelText("Active")).toBeChecked();
    expect(screen.queryByLabelText("Rule type")).not.toBeInTheDocument();
  });

  it("pre-fills fields for a position-scoped allocation rule in edit mode", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RuleForm
          action={vi.fn(async (): Promise<FormState> => ({ status: "idle" }))}
          hiddenFields={{ ruleId: "rule-1" }}
          defaultValues={{
            type: "allocation",
            metricKey: null,
            operator: null,
            threshold: null,
            role: "signal",
            minAllocation: 0,
            maxAllocation: 15,
            isActive: true,
          }}
          submitLabel="Save"
        />
      </NextIntlClientProvider>,
    );

    expect(screen.queryByLabelText("Metric key")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Min % per position")).toHaveValue(0);
    expect(screen.getByLabelText("Max % per position")).toHaveValue(15);
    expect(screen.getByLabelText("Active")).toBeChecked();
  });
});

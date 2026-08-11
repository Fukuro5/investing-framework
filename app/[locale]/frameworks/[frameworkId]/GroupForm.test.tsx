import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { FormState } from "./actions";
import { GroupForm } from "./GroupForm";

describe("GroupForm", () => {
  it("renders empty fields with hidden fields for create mode", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <GroupForm
          action={vi.fn(async (): Promise<FormState> => ({ status: "idle" }))}
          hiddenFields={{ frameworkId: "framework-1" }}
          submitLabel="Add group"
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("");
    const button = screen.getByRole("button", { name: "Add group" });
    expect(button.closest("form")?.querySelector('input[name="frameworkId"]')).toHaveValue("framework-1");
  });

  it("pre-fills the band and priority for edit mode", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <GroupForm
          action={vi.fn(async (): Promise<FormState> => ({ status: "idle" }))}
          hiddenFields={{ groupId: "group-1" }}
          defaultValues={{ name: "Core", targetAllocationMin: 65, targetAllocationMax: 75, priority: 0 }}
          submitLabel="Save"
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Core");
    expect(screen.getByLabelText("Min %")).toHaveValue(65);
    expect(screen.getByLabelText("Max %")).toHaveValue(75);
  });
});

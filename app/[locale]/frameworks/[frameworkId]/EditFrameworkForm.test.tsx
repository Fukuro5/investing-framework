import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import { EditFrameworkForm } from "./EditFrameworkForm";

describe("EditFrameworkForm", () => {
  it("pre-fills the current name and description", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <EditFrameworkForm frameworkId="framework-1" name="Quality" description="Core + convexity" />
      </NextIntlClientProvider>,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Quality");
    expect(screen.getByLabelText("Description")).toHaveValue("Core + convexity");
  });

  it("renders an empty description field when there is none", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <EditFrameworkForm frameworkId="framework-1" name="Quality" description={null} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByLabelText("Description")).toHaveValue("");
  });
});

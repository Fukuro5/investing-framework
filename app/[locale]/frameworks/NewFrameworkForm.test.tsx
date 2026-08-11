import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import { NewFrameworkForm } from "./NewFrameworkForm";

describe("NewFrameworkForm", () => {
  it("renders name and description fields and a submit button", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <NewFrameworkForm />
      </NextIntlClientProvider>,
    );

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create framework" })).toBeInTheDocument();
  });
});

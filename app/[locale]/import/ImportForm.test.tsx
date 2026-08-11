import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import { ImportForm } from "./ImportForm";

const renderImportForm = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ImportForm />
    </NextIntlClientProvider>,
  );

describe("ImportForm", () => {
  it("renders a file input and a submit button", () => {
    renderImportForm();

    expect(screen.getByLabelText("Statement file")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
  });
});

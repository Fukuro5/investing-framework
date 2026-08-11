import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { ActiveFrameworkAllocations } from "@/lib/frameworks/get-group-allocations";
import { GroupAllocationSummary } from "./GroupAllocationSummary";

type Messages = Record<string, unknown>;

const getNested = (source: Messages, path: string): unknown =>
  path.split(".").reduce<unknown>((acc, key) => (typeof acc === "object" && acc !== null ? (acc as Messages)[key] : undefined), source);

// getTranslations resolves to a "not supported in Client Components" stub
// under Vitest's jsdom environment (no real Next.js request context to read
// from — see app/[locale]/frameworks/actions.test.ts for the same issue).
// Mocked with a minimal placeholder-substitution translator reading the
// real messages/en.json content, so assertions check production text.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => {
    const namespaceMessages = (getNested(messages, namespace) as Messages) ?? {};
    return (key: string, params?: Record<string, string | number>) => {
      const template = String(getNested(namespaceMessages, key) ?? key);
      return params
        ? Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template)
        : template;
    };
  },
}));

const allocations: ActiveFrameworkAllocations = {
  framework: { id: "f1", name: "Quality" },
  groups: [
    { groupId: "g1", name: "Core", targetAllocationMin: 65, targetAllocationMax: 75, currentAllocationPercent: 60 },
    { groupId: "g2", name: "Convexity", targetAllocationMin: 15, targetAllocationMax: 25, currentAllocationPercent: 20 },
  ],
  unclassifiedAllocationPercent: 20,
};

const renderSummary = async () => {
  const jsx = await GroupAllocationSummary({ allocations, locale: "en" });
  render(<NextIntlClientProvider locale="en" messages={messages}>{jsx}</NextIntlClientProvider>);
};

const getRowFor = (label: string) => {
  const cell = screen.getByText(label);
  const row = cell.closest("tr");
  if (!row) {
    throw new Error(`No row found for "${label}"`);
  }
  return within(row);
};

describe("GroupAllocationSummary", () => {
  it("renders each group's target band and current allocation, plus the unclassified bucket", async () => {
    await renderSummary();

    expect(screen.getByText("Quality: allocation vs. target")).toBeInTheDocument();
    expect(getRowFor("Core").getByText("65%–75%")).toBeInTheDocument();
    expect(getRowFor("Core").getByText("60%")).toBeInTheDocument();
    expect(getRowFor("Unclassified").getByText("20%")).toBeInTheDocument();
  });

  it("flags a group whose current allocation is outside its target band, not one that's within it", async () => {
    await renderSummary();

    // Core is at 60%, below its 65-75% target.
    expect(getRowFor("Core").getByText("60%")).toHaveClass("text-amber-700");
    // Convexity is at 20%, within its 15-25% target.
    expect(getRowFor("Convexity").getByText("20%")).toHaveClass("text-green-700");
  });
});

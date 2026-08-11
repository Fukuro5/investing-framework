import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { PositionView } from "@/lib/dashboard/types";
import { UNCLASSIFIED_ASSIGNMENT_VALUE } from "@/lib/frameworks/consts";
import { AssignmentsTable } from "./AssignmentsTable";

type Messages = Record<string, unknown>;

const getNested = (source: Messages, path: string): unknown =>
  path.split(".").reduce<unknown>((acc, key) => (typeof acc === "object" && acc !== null ? (acc as Messages)[key] : undefined), source);

// See app/[locale]/GroupAllocationSummary.test.tsx for why this is mocked.
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

const buildPosition = (overrides: Partial<PositionView>): PositionView => ({
  accountId: "account-1",
  accountLabel: "Freedom Finance 000",
  instrumentId: "instrument-1",
  ticker: "TSM.US",
  name: "Taiwan Semiconductor",
  quantity: 5,
  avgCostPrice: 369.16,
  marketPrice: 418.47,
  marketPriceAsOf: new Date("2026-08-10"),
  marketValue: 2092.35,
  marketValueUsd: 2092.35,
  unrealizedPnl: 246.54,
  currency: "USD",
  allocationPercent: 100,
  source: "snapshot",
  ...overrides,
});

const renderTable = async (props: Parameters<typeof AssignmentsTable>[0]) => {
  const jsx = await AssignmentsTable(props);
  render(<NextIntlClientProvider locale="en" messages={messages}>{jsx}</NextIntlClientProvider>);
};

describe("AssignmentsTable", () => {
  it("shows the empty-state message when there are no positions", async () => {
    await renderTable({
      frameworkId: "framework-1",
      groups: [],
      positions: [],
      assignedGroupByInstrumentId: new Map(),
    });

    expect(screen.getByText("No positions to assign yet — import a statement first.")).toBeInTheDocument();
  });

  it("defaults the select to the current assignment, or unclassified when there isn't one", async () => {
    await renderTable({
      frameworkId: "framework-1",
      groups: [{ id: "core", name: "Core" }, { id: "convexity", name: "Convexity" }],
      positions: [buildPosition({ instrumentId: "a", ticker: "TSM.US" }), buildPosition({ instrumentId: "b", ticker: "O.US" })],
      assignedGroupByInstrumentId: new Map([["a", "core"]]),
    });

    const selects = screen.getAllByRole("combobox");
    expect(selects[0]).toHaveValue("core");
    expect(selects[1]).toHaveValue(UNCLASSIFIED_ASSIGNMENT_VALUE);
  });
});

import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import type { PositionView } from "@/lib/dashboard/types";
import type { PositionSignalView } from "@/lib/signals/get-active-framework-position-signals";
import { PositionsTable } from "./PositionsTable";

const buildPosition = (overrides: Partial<PositionView> = {}): PositionView => ({
  accountId: "account-1",
  accountLabel: "Freedom Finance 000",
  instrumentId: "instrument-1",
  ticker: "TSM.US",
  name: "Taiwan Semiconductor",
  quantity: 5,
  avgCostPrice: 369.16,
  marketPrice: 404.25,
  marketPriceAsOf: new Date("2026-08-10T20:00:00.000Z"),
  marketValue: 2021.25,
  marketValueUsd: 2021.25,
  unrealizedPnl: 175.44,
  currency: "USD",
  allocationPercent: 100,
  source: "snapshot",
  ...overrides,
});

const buildSignal = (overrides: Partial<PositionSignalView> = {}): PositionSignalView => ({
  instrumentId: "instrument-1",
  badge: "hold",
  health: "good",
  thesisSeverity: "good",
  metricSeverity: "good",
  allocationAction: "inBand",
  underperformingMetricCount: 0,
  thesisVerdict: "holding",
  thesisExplanation: "The moat remains intact.",
  underperformingMetricKeys: [],
  totalSignalMetricRuleCount: 2,
  allocationPercent: 7,
  allocationBand: { minAllocation: 5, maxAllocation: 10 },
  ...overrides,
});

const renderTable = (positions: PositionView[], signals: Map<string, PositionSignalView> | null = null) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PositionsTable positions={positions} signals={signals} locale="en" />
    </NextIntlClientProvider>,
  );

describe("PositionsTable", () => {
  it("renders the empty state when there are no positions", () => {
    renderTable([]);

    expect(screen.getByText("No positions yet. Import a broker statement to get started.")).toBeInTheDocument();
  });

  it("renders a row with formatted currency and percent values", () => {
    renderTable([buildPosition()]);

    expect(screen.getByText("TSM.US")).toBeInTheDocument();
    expect(screen.getByText("Taiwan Semiconductor")).toBeInTheDocument();
    expect(screen.getByText("$2,021.25")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("shows the unavailable placeholder for a null market price/date/value/allocation", () => {
    renderTable([
      buildPosition({
        marketPrice: null,
        marketPriceAsOf: null,
        marketValue: null,
        unrealizedPnl: null,
        allocationPercent: null,
        source: "derived",
      }),
    ]);

    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });

  it("omits the Signal column entirely when no framework is active", () => {
    renderTable([buildPosition()], null);

    expect(screen.queryByText("Signal")).not.toBeInTheDocument();
  });

  it("shows a badge and see-why breakdown for a position with a computed signal", () => {
    renderTable([buildPosition()], new Map([["instrument-1", buildSignal()]]));

    expect(screen.getByText("Signal")).toBeInTheDocument();
    expect(screen.getByText("Hold")).toBeInTheDocument();
    expect(screen.getByText("Thesis holding — The moat remains intact.")).toBeInTheDocument();
    expect(screen.getByText("0 of 2 signal metrics underperforming")).toBeInTheDocument();
    expect(screen.getByText("Allocation 7% (band 5%–10%)")).toBeInTheDocument();
  });

  it("shows 'unclassified' for a position with no entry in the signals map", () => {
    renderTable([buildPosition()], new Map());

    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });
});

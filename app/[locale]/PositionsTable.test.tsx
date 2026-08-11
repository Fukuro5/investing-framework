import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import type { PositionView } from "@/lib/dashboard/types";
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

const renderTable = (positions: PositionView[]) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PositionsTable positions={positions} locale="en" />
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
});

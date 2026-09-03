import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import type { PositionSignalView } from "@/lib/signals/get-active-framework-position-signals";
import { PositionSignalCell } from "./PositionSignalCell";

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

const renderCell = (signal: PositionSignalView | null) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PositionSignalCell signal={signal} locale="en" />
    </NextIntlClientProvider>,
  );

describe("PositionSignalCell", () => {
  it("renders the unclassified placeholder when there is no signal", () => {
    renderCell(null);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the badge and the full why-breakdown for a computed signal", () => {
    renderCell(buildSignal());

    expect(screen.getByText("Hold")).toBeInTheDocument();
    expect(screen.getByText("Thesis holding — The moat remains intact.")).toBeInTheDocument();
    expect(screen.getByText("0 of 2 signal metrics underperforming")).toBeInTheDocument();
    expect(screen.getByText("Allocation 7% (band 5%–10%)")).toBeInTheDocument();
  });

  it("shows 'not checked yet' when the position has no thesis verdict", () => {
    renderCell(buildSignal({ thesisVerdict: null, thesisExplanation: null }));

    expect(screen.getByText("Thesis not checked yet")).toBeInTheDocument();
  });

  it("shows 'no signal metric rules configured' when the group has none", () => {
    renderCell(buildSignal({ totalSignalMetricRuleCount: 0 }));

    expect(screen.getByText("No signal metric rules configured")).toBeInTheDocument();
  });

  it("shows 'no position allocation band configured' when the group has none", () => {
    renderCell(buildSignal({ allocationBand: null }));

    expect(screen.getByText("No position allocation band configured")).toBeInTheDocument();
  });

  it("shows the allocation as unavailable when the percent can't be resolved yet", () => {
    renderCell(buildSignal({ allocationPercent: null }));

    expect(screen.getByText("Allocation — (band 5%–10%)")).toBeInTheDocument();
  });
});

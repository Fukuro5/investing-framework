import { describe, expect, it } from "vitest";
import { withAllocationPercent } from "@/lib/dashboard/allocation";
import type { PositionView } from "@/lib/dashboard/types";

const buildPosition = (overrides: Partial<PositionView>): PositionView => ({
  accountId: "account-1",
  accountLabel: "Freedom Finance 000",
  instrumentId: "instrument-1",
  ticker: "TSM.US",
  name: "Taiwan Semiconductor",
  quantity: 5,
  avgCostPrice: 100,
  marketPrice: 100,
  marketValue: 500,
  unrealizedPnl: 0,
  currency: "USD",
  allocationPercent: null,
  source: "snapshot",
  ...overrides,
});

describe("withAllocationPercent", () => {
  it("splits allocation proportionally across USD positions", () => {
    const positions = [
      buildPosition({ instrumentId: "a", marketValue: 300 }),
      buildPosition({ instrumentId: "b", marketValue: 700 }),
    ];

    const [a, b] = withAllocationPercent(positions);

    expect(a.allocationPercent).toBe(30);
    expect(b.allocationPercent).toBe(70);
  });

  it("leaves allocation null for a non-USD position instead of mixing currencies", () => {
    const positions = [
      buildPosition({ instrumentId: "a", currency: "USD", marketValue: 500 }),
      buildPosition({ instrumentId: "b", currency: "EUR", marketValue: 500 }),
    ];

    const [a, b] = withAllocationPercent(positions);

    expect(a.allocationPercent).toBe(100);
    expect(b.allocationPercent).toBeNull();
  });

  it("leaves allocation null when market value is unknown (derived position with no price yet)", () => {
    const positions = [buildPosition({ marketValue: null })];

    const [position] = withAllocationPercent(positions);

    expect(position.allocationPercent).toBeNull();
  });

  it("leaves allocation null for every position when there is no USD market value at all", () => {
    const positions = [buildPosition({ currency: "EUR", marketValue: 100 })];

    const [position] = withAllocationPercent(positions);

    expect(position.allocationPercent).toBeNull();
  });
});

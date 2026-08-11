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
  marketPriceAsOf: new Date("2026-08-10"),
  marketValue: 500,
  marketValueUsd: 500,
  unrealizedPnl: 0,
  currency: "USD",
  allocationPercent: null,
  source: "snapshot",
  ...overrides,
});

describe("withAllocationPercent", () => {
  it("splits allocation proportionally across positions with a known USD value", () => {
    const positions = [
      buildPosition({ instrumentId: "a", marketValueUsd: 300 }),
      buildPosition({ instrumentId: "b", marketValueUsd: 700 }),
    ];

    const [a, b] = withAllocationPercent(positions);

    expect(a.allocationPercent).toBe(30);
    expect(b.allocationPercent).toBe(70);
  });

  it("leaves allocation null for a position with no cached FX rate (marketValueUsd null) instead of mixing currencies", () => {
    const positions = [
      buildPosition({ instrumentId: "a", currency: "USD", marketValueUsd: 500 }),
      buildPosition({ instrumentId: "b", currency: "EUR", marketValueUsd: null }),
    ];

    const [a, b] = withAllocationPercent(positions);

    expect(a.allocationPercent).toBe(100);
    expect(b.allocationPercent).toBeNull();
  });

  it("leaves allocation null when market value is unknown (derived position with no price yet)", () => {
    const positions = [buildPosition({ marketValue: null, marketValueUsd: null })];

    const [position] = withAllocationPercent(positions);

    expect(position.allocationPercent).toBeNull();
  });

  it("leaves allocation null for every position when there is no USD-convertible value at all", () => {
    const positions = [buildPosition({ currency: "EUR", marketValueUsd: null })];

    const [position] = withAllocationPercent(positions);

    expect(position.allocationPercent).toBeNull();
  });
});

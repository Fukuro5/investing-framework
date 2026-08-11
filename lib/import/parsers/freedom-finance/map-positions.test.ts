import { describe, expect, it } from "vitest";
import { mapPositionSnapshots } from "@/lib/import/parsers/freedom-finance/map-positions";
import type { FreedomFinancePositionRaw } from "@/lib/import/parsers/freedom-finance/raw-types";

const position: FreedomFinancePositionRaw = {
  i: "TSM.US",
  q: 5,
  curr: "USD",
  name: "Taiwan Semiconductor",
  issue_nb: "US8740391003",
  mkt_price: "404.25",
  price_a: 369.1612,
  mval: 2021.25,
  unrealized_profit: 175.44,
};

describe("mapPositionSnapshots", () => {
  it("maps a raw position onto a NormalizedPositionSnapshot", () => {
    const asOfDate = new Date("2026-07-31T23:59:59.000Z");
    const [snapshot] = mapPositionSnapshots([position], asOfDate);

    expect(snapshot).toEqual({
      instrument: {
        ticker: "TSM.US",
        isin: "US8740391003",
        name: "Taiwan Semiconductor",
        assetType: "unknown",
        currency: "USD",
        exchange: null,
      },
      asOfDate,
      quantity: 5,
      avgCostPrice: 369.1612,
      marketPrice: 404.25,
      marketValue: 2021.25,
      unrealizedPnl: 175.44,
      currency: "USD",
    });
  });

  it("maps an empty list to an empty list", () => {
    expect(mapPositionSnapshots([], new Date())).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { mapTrades } from "@/lib/import/parsers/freedom-finance/map-trades";
import type { FreedomFinanceTradeRaw } from "@/lib/import/parsers/freedom-finance/raw-types";

// Synthetic — mirrors the field shape documented in PLANNING.md §4 for a
// sell of O.US, since the real fixture's trades.detailed is empty for its
// period (no trades happened that month). Not verified against a real
// trade sample; revisit once one is available.
const sellTrade: FreedomFinanceTradeRaw = {
  transaction_id: 123456789,
  operation: "sell",
  p: 55.5,
  q: 10,
  commission: 1.2,
  curr_c: "USD",
  date: "2026-07-10 14:30:00",
  issue_nb: "US7561091049",
  instr_nm: "O.US",
  instr_kind: "акция обыкновенная",
};

describe("mapTrades", () => {
  it("maps a raw trade onto a NormalizedTransaction", () => {
    const [transaction] = mapTrades([sellTrade]);

    expect(transaction).toEqual({
      brokerRef: "123456789",
      type: "sell",
      date: new Date("2026-07-10T14:30:00.000Z"),
      instrument: {
        ticker: "O.US",
        isin: "US7561091049",
        name: "O.US",
        assetType: "акция обыкновенная",
        currency: "USD",
        exchange: null,
      },
      quantity: 10,
      price: 55.5,
      fees: 1.2,
      currency: "USD",
    });
  });

  it("throws for an operation other than buy/sell", () => {
    const invalidTrade = { ...sellTrade, operation: "split" };

    expect(() => mapTrades([invalidTrade])).toThrow(/unrecognized trade operation "split"/);
  });
});

import { describe, expect, it } from "vitest";
import { deriveCostBasis, type CostBasisTransaction } from "@/lib/dashboard/derive-cost-basis";

const buy = (quantity: number, price: number, date: string): CostBasisTransaction => ({
  type: "buy",
  quantity,
  price,
  date: new Date(date),
});

const sell = (quantity: number, price: number, date: string): CostBasisTransaction => ({
  type: "sell",
  quantity,
  price,
  date: new Date(date),
});

describe("deriveCostBasis", () => {
  it("returns zero quantity/cost for no transactions", () => {
    expect(deriveCostBasis([])).toEqual({ quantity: 0, avgCostPrice: 0 });
  });

  it("computes avg cost across two buys at different prices", () => {
    const result = deriveCostBasis([buy(5, 100, "2026-01-01"), buy(5, 200, "2026-02-01")]);

    expect(result).toEqual({ quantity: 10, avgCostPrice: 150 });
  });

  it("keeps the average cost per share after a partial sell", () => {
    // 10 shares @ $100 avg cost, sell 4 -> 6 remain, avg cost unchanged
    const result = deriveCostBasis([buy(10, 100, "2026-01-01"), sell(4, 999, "2026-02-01")]);

    expect(result).toEqual({ quantity: 6, avgCostPrice: 100 });
  });

  it("resets cost basis to zero once the full position is sold", () => {
    const result = deriveCostBasis([buy(10, 100, "2026-01-01"), sell(10, 150, "2026-02-01")]);

    expect(result).toEqual({ quantity: 0, avgCostPrice: 0 });
  });

  it("is order-independent — sorts by date before processing", () => {
    const result = deriveCostBasis([sell(4, 999, "2026-02-01"), buy(10, 100, "2026-01-01")]);

    expect(result).toEqual({ quantity: 6, avgCostPrice: 100 });
  });

  it("ignores a sell that exceeds the currently held quantity instead of going negative", () => {
    const result = deriveCostBasis([buy(5, 100, "2026-01-01"), sell(10, 150, "2026-02-01")]);

    expect(result.quantity).toBe(0);
  });

  it("ignores non-trade transaction types (dividend/fee/tax/deposit/withdrawal)", () => {
    const result = deriveCostBasis([
      buy(5, 100, "2026-01-01"),
      { type: "dividend", quantity: 5, price: 2, date: new Date("2026-01-15") },
    ]);

    expect(result).toEqual({ quantity: 5, avgCostPrice: 100 });
  });
});

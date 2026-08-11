import type { TransactionType } from "@/lib/import/types";

export interface CostBasisTransaction {
  type: TransactionType;
  quantity: number | null;
  price: number | null;
  date: Date;
}

export interface DerivedCostBasis {
  quantity: number;
  avgCostPrice: number;
}

// Weighted-average cost basis: the broker doesn't tell us which specific
// lot a sell drew from, so a sell shrinks the cost basis proportionally to
// the shares sold rather than assuming FIFO/LIFO — this mirrors how most
// brokers report "average cost" for a position. Only used as a fallback
// when no PositionSnapshot exists yet for this (account, instrument) — see
// PLANNING.md §3.
export const deriveCostBasis = (transactions: CostBasisTransaction[]): DerivedCostBasis => {
  const ordered = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());

  let quantity = 0;
  let costBasis = 0;

  for (const transaction of ordered) {
    if (transaction.type === "buy" && transaction.quantity && transaction.price) {
      quantity += transaction.quantity;
      costBasis += transaction.quantity * transaction.price;
    } else if (transaction.type === "sell" && transaction.quantity && quantity > 0) {
      const soldQuantity = Math.min(transaction.quantity, quantity);
      costBasis -= (soldQuantity / quantity) * costBasis;
      quantity -= soldQuantity;
    }
  }

  return { quantity, avgCostPrice: quantity > 0 ? costBasis / quantity : 0 };
};

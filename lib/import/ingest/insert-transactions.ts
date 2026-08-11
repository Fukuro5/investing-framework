import type { TransactionClient } from "@/lib/prisma";
import type { NormalizedTransaction } from "@/lib/import/types";

// Dedup happens per-transaction via brokerRef, not per-batch (PLANNING.md
// §3/§4) — a re-uploaded statement whose period partially overlaps a
// previous import still ingests cleanly, inserting only the transactions
// not already recorded for this account.
export const insertNewTransactions = async (
  db: TransactionClient,
  accountId: string,
  importBatchId: string,
  transactions: NormalizedTransaction[],
  instrumentIdByTicker: Map<string, string>,
): Promise<number> => {
  if (transactions.length === 0) {
    return 0;
  }

  const existing = await db.transaction.findMany({
    where: { accountId, brokerRef: { in: transactions.map((transaction) => transaction.brokerRef) } },
    select: { brokerRef: true },
  });
  const existingBrokerRefs = new Set(existing.map((row) => row.brokerRef));
  const newTransactions = transactions.filter((transaction) => !existingBrokerRefs.has(transaction.brokerRef));

  if (newTransactions.length === 0) {
    return 0;
  }

  const { count } = await db.transaction.createMany({
    data: newTransactions.map((transaction) => ({
      accountId,
      importBatchId,
      instrumentId: transaction.instrument ? (instrumentIdByTicker.get(transaction.instrument.ticker) ?? null) : null,
      type: transaction.type,
      date: transaction.date,
      quantity: transaction.quantity,
      price: transaction.price,
      fees: transaction.fees,
      currency: transaction.currency,
      brokerRef: transaction.brokerRef,
    })),
  });

  return count;
};

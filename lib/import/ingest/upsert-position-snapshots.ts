import type { TransactionClient } from "@/lib/prisma";
import type { NormalizedPositionSnapshot } from "@/lib/import/types";

// Position snapshots are broker-reported truth as of a given date, so
// re-importing the same period's statement should refresh the row rather
// than skip it — unlike Transaction, which dedupes and never overwrites.
export const upsertPositionSnapshots = async (
  db: TransactionClient,
  accountId: string,
  importBatchId: string,
  snapshots: NormalizedPositionSnapshot[],
  instrumentIdByTicker: Map<string, string>,
): Promise<number> => {
  await Promise.all(
    snapshots.map((snapshot) => {
      const instrumentId = instrumentIdByTicker.get(snapshot.instrument.ticker);

      if (!instrumentId) {
        throw new Error(`Position snapshot references unresolved instrument "${snapshot.instrument.ticker}"`);
      }

      return db.positionSnapshot.upsert({
        where: { accountId_instrumentId_asOfDate: { accountId, instrumentId, asOfDate: snapshot.asOfDate } },
        update: {
          importBatchId,
          quantity: snapshot.quantity,
          avgCostPrice: snapshot.avgCostPrice,
          marketPrice: snapshot.marketPrice,
          marketValue: snapshot.marketValue,
          unrealizedPnl: snapshot.unrealizedPnl,
          currency: snapshot.currency,
        },
        create: {
          accountId,
          instrumentId,
          importBatchId,
          asOfDate: snapshot.asOfDate,
          quantity: snapshot.quantity,
          avgCostPrice: snapshot.avgCostPrice,
          marketPrice: snapshot.marketPrice,
          marketValue: snapshot.marketValue,
          unrealizedPnl: snapshot.unrealizedPnl,
          currency: snapshot.currency,
        },
      });
    }),
  );

  return snapshots.length;
};

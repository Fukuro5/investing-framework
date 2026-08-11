import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveCostBasis, type CostBasisTransaction } from "@/lib/dashboard/derive-cost-basis";
import type { PositionView } from "@/lib/dashboard/types";
import { isTransactionType } from "@/lib/import/consts";

interface AccountInstrumentKey {
  accountId: string;
  instrumentId: string;
}

const keyOf = ({ accountId, instrumentId }: AccountInstrumentKey) => `${accountId}:${instrumentId}`;

// `db` defaults to the app's shared Prisma client and is only overridden in
// tests, matching the pattern used by ingestStatement.
export const getPositions = async (db: PrismaClient = prisma): Promise<PositionView[]> => {
  const [snapshots, transactions, accounts, instruments, priceSnapshots] = await Promise.all([
    db.positionSnapshot.findMany({ orderBy: { asOfDate: "desc" } }),
    db.transaction.findMany({ where: { instrumentId: { not: null } }, orderBy: { date: "asc" } }),
    db.account.findMany(),
    db.instrument.findMany(),
    db.priceSnapshot.findMany({ orderBy: { date: "desc" } }),
  ]);

  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const instrumentsById = new Map(instruments.map((instrument) => [instrument.id, instrument]));

  const latestPriceByInstrumentId = new Map<string, number>();
  for (const priceSnapshot of priceSnapshots) {
    if (!latestPriceByInstrumentId.has(priceSnapshot.instrumentId)) {
      latestPriceByInstrumentId.set(priceSnapshot.instrumentId, priceSnapshot.price);
    }
  }

  // positionSnapshot.findMany above is already ordered newest-first, so the
  // first row seen per key is the latest one — prefer it over deriving from
  // transactions (PLANNING.md §3).
  const latestSnapshotByKey = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) {
    const key = keyOf(snapshot);
    if (!latestSnapshotByKey.has(key)) {
      latestSnapshotByKey.set(key, snapshot);
    }
  }

  const transactionsByKey = new Map<string, { account: AccountInstrumentKey; transactions: CostBasisTransaction[] }>();
  for (const transaction of transactions) {
    if (!transaction.instrumentId || !isTransactionType(transaction.type)) {
      continue;
    }

    const account = { accountId: transaction.accountId, instrumentId: transaction.instrumentId };
    const key = keyOf(account);
    const entry = transactionsByKey.get(key) ?? { account, transactions: [] };
    entry.transactions.push({ type: transaction.type, quantity: transaction.quantity, price: transaction.price, date: transaction.date });
    transactionsByKey.set(key, entry);
  }

  const positions: PositionView[] = [];

  for (const snapshot of latestSnapshotByKey.values()) {
    if (snapshot.quantity === 0) {
      continue;
    }

    const account = accountsById.get(snapshot.accountId);
    const instrument = instrumentsById.get(snapshot.instrumentId);

    if (!account || !instrument) {
      throw new Error(`Position snapshot ${snapshot.id} references a missing account or instrument`);
    }

    positions.push({
      accountId: account.id,
      accountLabel: account.label,
      instrumentId: instrument.id,
      ticker: instrument.ticker,
      name: instrument.name,
      quantity: snapshot.quantity,
      avgCostPrice: snapshot.avgCostPrice,
      marketPrice: snapshot.marketPrice,
      marketValue: snapshot.marketValue,
      unrealizedPnl: snapshot.unrealizedPnl,
      currency: snapshot.currency,
      allocationPercent: null,
      source: "snapshot",
    });
  }

  for (const { account: accountKey, transactions: costBasisTransactions } of transactionsByKey.values()) {
    if (latestSnapshotByKey.has(keyOf(accountKey))) {
      continue;
    }

    const { quantity, avgCostPrice } = deriveCostBasis(costBasisTransactions);

    if (quantity === 0) {
      continue;
    }

    const account = accountsById.get(accountKey.accountId);
    const instrument = instrumentsById.get(accountKey.instrumentId);

    if (!account || !instrument) {
      throw new Error(`Transaction references a missing account or instrument (${accountKey.accountId}/${accountKey.instrumentId})`);
    }

    const marketPrice = latestPriceByInstrumentId.get(instrument.id) ?? null;
    const marketValue = marketPrice !== null ? quantity * marketPrice : null;
    const unrealizedPnl = marketValue !== null ? marketValue - quantity * avgCostPrice : null;

    positions.push({
      accountId: account.id,
      accountLabel: account.label,
      instrumentId: instrument.id,
      ticker: instrument.ticker,
      name: instrument.name,
      quantity,
      avgCostPrice,
      marketPrice,
      marketValue,
      unrealizedPnl,
      currency: instrument.currency,
      allocationPercent: null,
      source: "derived",
    });
  }

  return positions;
};

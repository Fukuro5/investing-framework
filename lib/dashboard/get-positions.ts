import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BASE_CURRENCY } from "@/lib/dashboard/consts";
import { deriveCostBasis, type CostBasisTransaction } from "@/lib/dashboard/derive-cost-basis";
import type { PositionView } from "@/lib/dashboard/types";
import { isTransactionType } from "@/lib/import/consts";

interface AccountInstrumentKey {
  accountId: string;
  instrumentId: string;
}

interface CostBasis {
  quantity: number;
  avgCostPrice: number;
  source: "snapshot" | "derived";
}

const keyOf = ({ accountId, instrumentId }: AccountInstrumentKey) => `${accountId}:${instrumentId}`;

// Converts via a cached FxRateSnapshot (PLANNING.md §6) — null when the
// currency isn't USD and no cached rate has been fetched yet, rather than
// guessing a rate or mixing currencies into one total.
const toUsd = (marketValue: number | null, currency: string, fxRateToUsdByCurrency: Map<string, number>): number | null => {
  if (marketValue === null) {
    return null;
  }

  if (currency === BASE_CURRENCY) {
    return marketValue;
  }

  const rate = fxRateToUsdByCurrency.get(currency);
  return rate === undefined ? null : marketValue * rate;
};

// `db` defaults to the app's shared Prisma client and is only overridden in
// tests, matching the pattern used by ingestStatement.
export const getPositions = async (db: PrismaClient = prisma): Promise<PositionView[]> => {
  const [snapshots, transactions, accounts, instruments, priceSnapshots, fxRateSnapshots] = await Promise.all([
    db.positionSnapshot.findMany({ orderBy: { asOfDate: "desc" } }),
    db.transaction.findMany({ where: { instrumentId: { not: null } }, orderBy: { date: "asc" } }),
    db.account.findMany(),
    db.instrument.findMany(),
    db.priceSnapshot.findMany({ orderBy: { date: "desc" } }),
    db.fxRateSnapshot.findMany({ where: { quoteCurrency: BASE_CURRENCY } }),
  ]);

  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const instrumentsById = new Map(instruments.map((instrument) => [instrument.id, instrument]));
  const fxRateToUsdByCurrency = new Map(fxRateSnapshots.map((fxRate) => [fxRate.baseCurrency, fxRate.rate]));

  // Current price/value/P&L always come from here — a broker statement's
  // reported price can be a month stale by the time you look at it, so it's
  // never used for display; only quantity/avgCostPrice come from the
  // broker (see CostBasis below). Populated by "Refresh prices" — null
  // until then. `date` is the quote's own as-of date (from the provider),
  // shown alongside the price so it's clear exactly how fresh it is.
  const latestPriceByInstrumentId = new Map<string, { price: number; date: Date }>();
  for (const priceSnapshot of priceSnapshots) {
    if (!latestPriceByInstrumentId.has(priceSnapshot.instrumentId)) {
      latestPriceByInstrumentId.set(priceSnapshot.instrumentId, { price: priceSnapshot.price, date: priceSnapshot.date });
    }
  }

  // positionSnapshot.findMany above is already ordered newest-first, so the
  // first row seen per key is the latest one — prefer it over deriving from
  // transactions (PLANNING.md §3), but only for quantity/avgCostPrice.
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

  const accountKeys = new Map<string, AccountInstrumentKey>();
  for (const snapshot of latestSnapshotByKey.values()) {
    accountKeys.set(keyOf(snapshot), { accountId: snapshot.accountId, instrumentId: snapshot.instrumentId });
  }
  for (const { account } of transactionsByKey.values()) {
    const key = keyOf(account);
    if (!accountKeys.has(key)) {
      accountKeys.set(key, account);
    }
  }

  const resolveCostBasis = (key: string): CostBasis => {
    const snapshot = latestSnapshotByKey.get(key);
    if (snapshot) {
      return { quantity: snapshot.quantity, avgCostPrice: snapshot.avgCostPrice, source: "snapshot" };
    }

    const transactionsEntry = transactionsByKey.get(key);
    const { quantity, avgCostPrice } = deriveCostBasis(transactionsEntry?.transactions ?? []);
    return { quantity, avgCostPrice, source: "derived" };
  };

  const positions: PositionView[] = [];

  for (const [key, accountKey] of accountKeys) {
    const costBasis = resolveCostBasis(key);

    if (costBasis.quantity === 0) {
      continue;
    }

    const account = accountsById.get(accountKey.accountId);
    const instrument = instrumentsById.get(accountKey.instrumentId);

    if (!account || !instrument) {
      throw new Error(`Position references a missing account or instrument (${accountKey.accountId}/${accountKey.instrumentId})`);
    }

    const latestPrice = latestPriceByInstrumentId.get(instrument.id) ?? null;
    const marketPrice = latestPrice?.price ?? null;
    const marketValue = marketPrice !== null ? costBasis.quantity * marketPrice : null;
    const unrealizedPnl = marketValue !== null ? marketValue - costBasis.quantity * costBasis.avgCostPrice : null;

    positions.push({
      accountId: account.id,
      accountLabel: account.label,
      instrumentId: instrument.id,
      ticker: instrument.ticker,
      name: instrument.name,
      quantity: costBasis.quantity,
      avgCostPrice: costBasis.avgCostPrice,
      marketPrice,
      marketPriceAsOf: latestPrice?.date ?? null,
      marketValue,
      marketValueUsd: toUsd(marketValue, instrument.currency, fxRateToUsdByCurrency),
      unrealizedPnl,
      currency: instrument.currency,
      allocationPercent: null,
      source: costBasis.source,
    });
  }

  return positions;
};

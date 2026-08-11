import type { TransactionClient } from "@/lib/prisma";
import type { NormalizedInstrumentRef } from "@/lib/import/types";

const dedupeByTicker = (refs: NormalizedInstrumentRef[]): NormalizedInstrumentRef[] => {
  const byTicker = new Map(refs.map((ref) => [ref.ticker, ref]));
  return [...byTicker.values()];
};

// Find-or-create every distinct instrument referenced by a statement, up
// front, so transactions/position snapshots can be inserted with a resolved
// instrumentId. Returns a ticker -> Instrument.id lookup.
export const resolveInstruments = async (
  db: TransactionClient,
  refs: NormalizedInstrumentRef[],
): Promise<Map<string, string>> => {
  const uniqueRefs = dedupeByTicker(refs);

  const instruments = await Promise.all(
    uniqueRefs.map((ref) =>
      db.instrument.upsert({
        where: { ticker: ref.ticker },
        update: {},
        create: {
          ticker: ref.ticker,
          isin: ref.isin,
          name: ref.name,
          assetType: ref.assetType,
          currency: ref.currency,
          exchange: ref.exchange,
        },
      }),
    ),
  );

  return new Map(instruments.map((instrument) => [instrument.ticker, instrument.id]));
};

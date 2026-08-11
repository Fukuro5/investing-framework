import { toNumber } from "@/lib/import/parsers/freedom-finance/normalize";
import type { FreedomFinancePositionRaw } from "@/lib/import/parsers/freedom-finance/raw-types";
import type { NormalizedInstrumentRef, NormalizedPositionSnapshot } from "@/lib/import/types";

// The broker export has multiple fields that look like "market value"
// (market_value vs posval/mval). posval/mval move with mkt_price between
// the start/end snapshots in the real sample while market_value doesn't,
// so mval is the live market value — see PLANNING.md §4/§10.
const buildInstrumentRef = (position: FreedomFinancePositionRaw): NormalizedInstrumentRef => ({
  ticker: position.i,
  isin: position.issue_nb,
  name: position.name,
  assetType: "unknown",
  currency: position.curr,
  exchange: null,
});

export const mapPositionSnapshots = (
  positions: FreedomFinancePositionRaw[],
  asOfDate: Date,
): NormalizedPositionSnapshot[] =>
  positions.map((position) => ({
    instrument: buildInstrumentRef(position),
    asOfDate,
    quantity: toNumber(position.q),
    avgCostPrice: toNumber(position.price_a),
    marketPrice: toNumber(position.mkt_price),
    marketValue: toNumber(position.mval),
    unrealizedPnl: toNumber(position.unrealized_profit),
    currency: position.curr,
  }));

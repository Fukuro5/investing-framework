export interface PositionView {
  accountId: string;
  accountLabel: string;
  instrumentId: string;
  ticker: string;
  name: string;
  // quantity/avgCostPrice: broker-reported (PositionSnapshot) when
  // available, else derived from Transaction rows — see `source`.
  quantity: number;
  avgCostPrice: number;
  // marketPrice/marketValue: always from the cached PriceSnapshot (Finnhub
  // refresh), never from a broker statement's reported price — a monthly
  // statement's price can be weeks stale by the time you look at it. Null
  // until "Refresh prices" has been run at least once for this instrument.
  marketPrice: number | null;
  // The quote's own as-of date/time (from the provider, e.g. Finnhub's
  // last-trade timestamp) — not when the refresh ran, so it's clear how
  // fresh the underlying quote actually is. Null alongside marketPrice.
  marketPriceAsOf: Date | null;
  marketValue: number | null;
  // marketValue converted to USD via a cached FxRateSnapshot (PLANNING.md
  // §6) — equal to marketValue when currency is already USD, null when the
  // currency isn't USD and no cached rate exists yet.
  marketValueUsd: number | null;
  unrealizedPnl: number | null;
  currency: string;
  allocationPercent: number | null;
  // Where quantity/avgCostPrice came from: "snapshot" = broker-reported
  // truth as of the latest import; "derived" = aggregated from Transaction
  // rows because no snapshot exists yet for this (account, instrument) —
  // see PLANNING.md §3. Unrelated to marketPrice, which is always live.
  source: "snapshot" | "derived";
}

export interface PositionView {
  accountId: string;
  accountLabel: string;
  instrumentId: string;
  ticker: string;
  name: string;
  quantity: number;
  avgCostPrice: number;
  marketPrice: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  currency: string;
  allocationPercent: number | null;
  // "snapshot" = broker-reported truth as of the latest import; "derived"
  // = aggregated from Transaction rows because no snapshot exists yet for
  // this (account, instrument) — see PLANNING.md §3.
  source: "snapshot" | "derived";
}

// The authoritative list of metric keys the app knows how to fetch from
// FMP (PLANNING.md §1 Phase 2). Both GroupRule.metricKey and manually
// entered MetricValue.metricKey are validated against this at
// creation/update time, and it's the single source both the FMP provider
// (which field maps to which endpoint) and the rule/metrics UIs (which
// keys to offer) read from — replaces the old freeform-string /
// UI-suggestion-only SUGGESTED_METRIC_KEYS.
export const METRIC_KEYS = [
  "peRatio",
  "dividendYield",
  "priceToBook",
  "debtToEquity",
  "netProfitMargin",
  "currentRatio",
  "roic",
  "returnOnEquity",
  "freeCashFlowYield",
] as const;

export const isMetricKey = (value: string): value is (typeof METRIC_KEYS)[number] =>
  METRIC_KEYS.includes(value as (typeof METRIC_KEYS)[number]);

// Field names confirmed against real /stable responses for AAPL (2026-09-10).
// Keyed by plain `string` (not the METRIC_KEYS union) so the FMP provider
// can index them with a metricKey it only knows is a string at that point.
export const RATIOS_TTM_METRIC_FIELDS: Record<string, string> = {
  peRatio: "priceToEarningsRatioTTM",
  dividendYield: "dividendYieldTTM",
  priceToBook: "priceToBookRatioTTM",
  debtToEquity: "debtToEquityRatioTTM",
  netProfitMargin: "netProfitMarginTTM",
  currentRatio: "currentRatioTTM",
};

export const KEY_METRICS_TTM_METRIC_FIELDS: Record<string, string> = {
  roic: "returnOnInvestedCapitalTTM",
  returnOnEquity: "returnOnEquityTTM",
  freeCashFlowYield: "freeCashFlowYieldTTM",
};

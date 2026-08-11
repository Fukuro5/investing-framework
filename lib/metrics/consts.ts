export const METRIC_SOURCES = ["api", "manual"] as const;

// Examples from PLANNING.md §3/§5 — the catalog is deliberately open-ended
// (any string is a valid metricKey), this is just a convenience list for
// the UI's suggestions; GroupRule/MetricValue never validate against it.
export const SUGGESTED_METRIC_KEYS = ["fcf", "roic", "peRatio", "dividendYield", "convexity"] as const;

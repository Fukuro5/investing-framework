export const EDGAR_DATA_BASE_URL = "https://data.sec.gov";
export const EDGAR_WWW_BASE_URL = "https://www.sec.gov";

// Revenue's XBRL tag varies by company/ASC-606-adoption era — tried in this
// order until one returns data (PLANNING.md §1 Phase 3a).
export const REVENUE_TAG_CANDIDATES = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
] as const;

export const NET_INCOME_TAG = "NetIncomeLoss";

// Only these carry the financial statements the trend check needs — other
// filing types (8-K, proxy, ...) are ignored by the "is there anything new"
// check (PLANNING.md §1 Phase 3).
export const TRACKED_FORM_TYPES = ["10-K", "10-Q"] as const;

// Slots into the existing MetricValue table (source: "api") rather than a
// new table (PLANNING.md §1 Phase 3a) — value is encoded 1/0/-1, see
// compute-financials-trend.ts.
export const TREND_METRIC_KEY = "edgarFinancialsTrend";

// A line item only counts as having "moved" past this magnitude of YoY
// change — otherwise it's treated as flat (PLANNING.md §1 Phase 3a default).
export const TREND_MOVE_THRESHOLD_PERCENT = 5;

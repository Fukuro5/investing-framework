export const EDGAR_DATA_BASE_URL = "https://data.sec.gov";
export const EDGAR_WWW_BASE_URL = "https://www.sec.gov";

// Only these carry the financial statements the trend check needs — other
// filing types (8-K, proxy, ...) are ignored by the "is there anything new"
// check (PLANNING.md §1 Phase 3). 20-F is the annual report foreign private
// issuers file instead of a 10-K — they don't file a 10-Q equivalent
// (interim reports go out as unstructured 6-Ks instead), so there's no
// quarterly counterpart to track for those filers.
export const TRACKED_FORM_TYPES = ["10-K", "10-Q", "20-F"] as const;

// Line-item candidates (which XBRL tags/taxonomies feed the trend verdict)
// live in line-items.ts, not here — see REQUIRED_LINE_ITEMS/OPTIONAL_LINE_ITEMS.

// Slots into the existing MetricValue table (source: "api") rather than a
// new table (PLANNING.md §1 Phase 3a) — value is encoded 1/0/-1, see
// compute-financials-trend.ts.
export const TREND_METRIC_KEY = "edgarFinancialsTrend";

// A line item only counts as having "moved" past this magnitude of YoY
// change — otherwise it's treated as flat (PLANNING.md §1 Phase 3a default).
export const TREND_MOVE_THRESHOLD_PERCENT = 5;

import { KEY_METRICS_TTM_METRIC_FIELDS, RATIOS_TTM_METRIC_FIELDS } from "@/lib/metrics/catalog";
import type { MetricResult } from "@/lib/market-data/types";

// FMP's older /api/v3/*-ttm endpoints are dead ("Legacy Endpoint... only
// available for legacy users who have valid subscriptions prior August
// 31, 2025" — confirmed empirically against a real key); the current API
// lives under /stable and takes the symbol as a query param, not a path
// segment.
const FMP_BASE_URL = "https://financialmodelingprep.com/stable";
const US_SUFFIX = ".US";

export interface MetricProvider {
  getMetric(ticker: string, metricKey: string): Promise<MetricResult | null>;
}

// Both TTM endpoints return dozens of fields beyond what the catalog maps
// today (§9 of the Phase 2 research) — a plain index type instead of a
// fixed set of optional keys, since which field gets read is decided at
// runtime by RATIOS_TTM_METRIC_FIELDS/KEY_METRICS_TTM_METRIC_FIELDS.
type FmpRatiosTtmResponse = Record<string, number | undefined>;
type FmpKeyMetricsTtmResponse = Record<string, number | undefined>;

// Mirrors toTwelveDataSymbol: strips Freedom Finance's ".US" suffix —
// unconfirmed against a real non-US FMP symbol so far (only US tickers
// verified), same caveat as the other providers (PLANNING.md §5).
export const toFmpSymbol = (ticker: string): string => (ticker.endsWith(US_SUFFIX) ? ticker.slice(0, -US_SUFFIX.length) : ticker);

const getJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`FMP request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

// FMP's TTM endpoints return a continuously-current trailing-twelve-month
// snapshot with no per-value date of their own, same as Finnhub's flat
// "metric" fields — day-truncated so repeated refreshes within the same
// day upsert the same MetricValue row (its unique key includes asOfDate).
const startOfToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export const createFmpProvider = (apiKey: string): MetricProvider => ({
  getMetric: async (ticker: string, metricKey: string): Promise<MetricResult | null> => {
    const ratiosField = RATIOS_TTM_METRIC_FIELDS[metricKey];
    const keyMetricsField = KEY_METRICS_TTM_METRIC_FIELDS[metricKey];

    if (!ratiosField && !keyMetricsField) {
      return null;
    }

    const symbol = toFmpSymbol(ticker);

    if (ratiosField) {
      const url = `${FMP_BASE_URL}/ratios-ttm?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
      const [data] = await getJson<FmpRatiosTtmResponse[]>(url);
      const value = data?.[ratiosField];
      return typeof value === "number" ? { value, asOfDate: startOfToday() } : null;
    }

    const url = `${FMP_BASE_URL}/key-metrics-ttm?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const [data] = await getJson<FmpKeyMetricsTtmResponse[]>(url);
    const value = data?.[keyMetricsField];
    return typeof value === "number" ? { value, asOfDate: startOfToday() } : null;
  },
});

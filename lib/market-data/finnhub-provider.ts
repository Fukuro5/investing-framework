import type { MarketDataProvider, MetricResult, Quote } from "@/lib/market-data/types";

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const US_SUFFIX = ".US";

interface FinnhubQuoteResponse {
  c: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

interface FinnhubForexRatesResponse {
  base: string;
  quote: Record<string, number>;
}

interface FinnhubSeriesPoint {
  period: string;
  v: number;
}

interface FinnhubBasicFinancialsResponse {
  metric: Record<string, number | null | undefined>;
  series?: {
    annual?: Record<string, FinnhubSeriesPoint[]>;
  };
}

// Freedom Finance tickers carry a broker-specific market suffix (e.g.
// "TSM.US" — lib/import/parsers/freedom-finance). Finnhub drops the suffix
// for US-listed symbols but keeps a suffix for many other exchanges (e.g.
// "RY.TO") — only the ".US" case is confirmed against real data so far;
// other suffixes pass through unchanged until confirmed against a real
// non-US instrument.
export const toFinnhubSymbol = (ticker: string): string =>
  ticker.endsWith(US_SUFFIX) ? ticker.slice(0, -US_SUFFIX.length) : ticker;

const getJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Finnhub request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

// Finnhub's quote endpoint returns c:0/t:0 for an unrecognized symbol
// rather than an HTTP error, so a zero quote is treated as "no data" —
// real equities practically never trade at exactly $0.
const isEmptyQuote = (quote: FinnhubQuoteResponse) => quote.c === 0 && quote.t === 0;

// Only metrics with a confirmed Finnhub field are fetched — everything else
// (fcf, convexity, or any custom key) returns null without an API call, per
// PLANNING.md §6's expectation that most fundamentals stay manual-only.
// FLAT_METRIC_FIELDS come from the response's "metric" object (a current
// TTM/normalized snapshot with no per-value date, so "now" is used as
// asOfDate); ANNUAL_SERIES_FIELDS come from "series.annual", which does
// carry a real reporting-period date per value.
const FLAT_METRIC_FIELDS: Record<string, string> = {
  peRatio: "peNormalizedAnnual",
  dividendYield: "currentDividendYieldTTM",
};

const ANNUAL_SERIES_FIELDS: Record<string, string> = {
  roic: "roic",
};

const latestSeriesPoint = (points: FinnhubSeriesPoint[]): FinnhubSeriesPoint | null =>
  points.reduce<FinnhubSeriesPoint | null>((latest, point) => (!latest || point.period > latest.period ? point : latest), null);

// Flat metrics (the "metric" object) are a continuously-current TTM
// snapshot with no per-value date of their own — day-truncated so that
// repeated refreshes within the same day upsert the same MetricValue row
// instead of piling up a new one on every click (MetricValue's unique key
// includes asOfDate).
const startOfToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export const createFinnhubProvider = (apiKey: string): MarketDataProvider => ({
  getQuote: async (ticker: string): Promise<Quote> => {
    const symbol = toFinnhubSymbol(ticker);
    const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const quote = await getJson<FinnhubQuoteResponse>(url);

    if (isEmptyQuote(quote)) {
      throw new Error(`Finnhub has no quote data for symbol "${symbol}" (ticker "${ticker}")`);
    }

    return { price: quote.c, asOf: new Date(quote.t * 1000) };
  },

  getFxRate: async (base: string, quote: string): Promise<number> => {
    const url = `${FINNHUB_BASE_URL}/forex/rates?base=${encodeURIComponent(base)}&token=${apiKey}`;
    const rates = await getJson<FinnhubForexRatesResponse>(url);
    const rate = rates.quote[quote];

    if (rate === undefined) {
      throw new Error(`Finnhub has no forex rate from "${base}" to "${quote}"`);
    }

    return rate;
  },

  getMetric: async (ticker: string, metricKey: string): Promise<MetricResult | null> => {
    const flatField = FLAT_METRIC_FIELDS[metricKey];
    const seriesField = ANNUAL_SERIES_FIELDS[metricKey];

    if (!flatField && !seriesField) {
      return null;
    }

    const symbol = toFinnhubSymbol(ticker);
    const url = `${FINNHUB_BASE_URL}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${apiKey}`;
    const data = await getJson<FinnhubBasicFinancialsResponse>(url);

    if (flatField) {
      const value = data.metric[flatField];
      return typeof value === "number" ? { value, asOfDate: startOfToday() } : null;
    }

    const points = data.series?.annual?.[seriesField] ?? [];
    const latest = latestSeriesPoint(points);
    return latest ? { value: latest.v, asOfDate: new Date(latest.period) } : null;
  },
});

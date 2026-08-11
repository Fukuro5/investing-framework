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

  // Fundamentals are Phase 5 scope (PLANNING.md §5/§8) — not implemented
  // yet, so callers should treat every metric as manual-only for now.
  getMetric: async (): Promise<MetricResult | null> => null,
});

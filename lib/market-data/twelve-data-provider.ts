import type { Quote } from "@/lib/market-data/types";

const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com";
const US_SUFFIX = ".US";

export interface QuoteFxProvider {
  getQuote(ticker: string): Promise<Quote>;
  getFxRate(base: string, quote: string): Promise<number>;
}

interface TwelveDataQuoteResponse {
  close?: string;
  timestamp?: number;
  message?: string;
}

interface TwelveDataExchangeRateResponse {
  rate?: number;
  message?: string;
}

// Freedom Finance tickers carry a broker-specific market suffix (e.g.
// "TSM.US" — lib/import/parsers/freedom-finance). Mirrors the previous
// Finnhub provider's assumption that a US-listed ticker's bare symbol is
// what the provider expects — unconfirmed against real Twelve Data
// responses until TWELVE_DATA_API_KEY is wired up (PLANNING.md §5).
export const toTwelveDataSymbol = (ticker: string): string =>
  ticker.endsWith(US_SUFFIX) ? ticker.slice(0, -US_SUFFIX.length) : ticker;

const getJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Twelve Data request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const createTwelveDataProvider = (apiKey: string): QuoteFxProvider => ({
  getQuote: async (ticker: string): Promise<Quote> => {
    const symbol = toTwelveDataSymbol(ticker);
    const url = `${TWELVE_DATA_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const quote = await getJson<TwelveDataQuoteResponse>(url);

    if (quote.close === undefined || quote.timestamp === undefined) {
      throw new Error(
        `Twelve Data has no quote data for symbol "${symbol}" (ticker "${ticker}"): ${quote.message ?? "unknown error"}`,
      );
    }

    return { price: Number(quote.close), asOf: new Date(quote.timestamp * 1000) };
  },

  getFxRate: async (base: string, quote: string): Promise<number> => {
    const symbol = `${base}/${quote}`;
    const url = `${TWELVE_DATA_BASE_URL}/exchange_rate?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const data = await getJson<TwelveDataExchangeRateResponse>(url);

    if (data.rate === undefined) {
      throw new Error(`Twelve Data has no forex rate from "${base}" to "${quote}": ${data.message ?? "unknown error"}`);
    }

    return data.rate;
  },
});

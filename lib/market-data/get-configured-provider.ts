import { createFinnhubProvider } from "@/lib/market-data/finnhub-provider";
import type { MarketDataProvider } from "@/lib/market-data/types";

export class MissingApiKeyError extends Error {}

// Reads FINNHUB_API_KEY lazily (only when a refresh is actually triggered)
// rather than at module load — prices/metrics are fetched on-demand, never
// on every page load (PLANNING.md §6), so most of the app never needs this
// key at all.
export const getConfiguredProvider = (): MarketDataProvider => {
  const { FINNHUB_API_KEY } = process.env;

  if (!FINNHUB_API_KEY) {
    throw new MissingApiKeyError("FINNHUB_API_KEY is not set");
  }

  return createFinnhubProvider(FINNHUB_API_KEY);
};

import { createCompositeProvider } from "@/lib/market-data/composite-provider";
import { createFmpProvider } from "@/lib/market-data/fmp-provider";
import { createTwelveDataProvider } from "@/lib/market-data/twelve-data-provider";
import type { MarketDataProvider } from "@/lib/market-data/types";

export class MissingApiKeyError extends Error {}

// Reads the API keys lazily (only when a refresh is actually triggered)
// rather than at module load — prices/metrics are fetched on-demand, never
// on every page load (PLANNING.md §6), so most of the app never needs
// either key at all.
export const getConfiguredProvider = (): MarketDataProvider => {
  const { TWELVE_DATA_API_KEY, FMP_API_KEY } = process.env;

  if (!TWELVE_DATA_API_KEY) {
    throw new MissingApiKeyError("TWELVE_DATA_API_KEY is not set");
  }

  if (!FMP_API_KEY) {
    throw new MissingApiKeyError("FMP_API_KEY is not set");
  }

  return createCompositeProvider(createTwelveDataProvider(TWELVE_DATA_API_KEY), createFmpProvider(FMP_API_KEY));
};

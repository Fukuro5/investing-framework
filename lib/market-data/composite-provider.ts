import type { QuoteFxProvider } from "@/lib/market-data/twelve-data-provider";
import type { MetricProvider } from "@/lib/market-data/fmp-provider";
import type { MarketDataProvider, MetricResult, Quote } from "@/lib/market-data/types";

// Twelve Data (quotes + FX) and FMP (fundamentals) are two separate
// free-tier providers, each covering one concern (PLANNING.md §1 Phase 1).
// This composes both behind the single MarketDataProvider interface so
// every existing caller (refreshMarketData, classifyInstruments, ...)
// keeps calling one provider without knowing two vendors are involved.
export const createCompositeProvider = (quoteFxProvider: QuoteFxProvider, metricProvider: MetricProvider): MarketDataProvider => ({
  getQuote: (ticker: string): Promise<Quote> => quoteFxProvider.getQuote(ticker),
  getFxRate: (base: string, quote: string): Promise<number> => quoteFxProvider.getFxRate(base, quote),
  getMetric: (ticker: string, metricKey: string): Promise<MetricResult | null> => metricProvider.getMetric(ticker, metricKey),
});

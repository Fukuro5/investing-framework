export interface Quote {
  price: number;
  asOf: Date;
}

export interface MetricResult {
  value: number;
  asOfDate: Date;
}

// All price/metric fetching goes through this interface, never a direct
// provider SDK call from application code (PLANNING.md §6) — swapping
// providers later means writing one new implementation, nothing that calls
// MarketDataProvider needs to change.
export interface MarketDataProvider {
  getQuote(ticker: string): Promise<Quote>;
  getFxRate(base: string, quote: string): Promise<number>;
  getMetric?(ticker: string, metricKey: string): Promise<MetricResult | null>;
}

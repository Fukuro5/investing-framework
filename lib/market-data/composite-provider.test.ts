import { describe, expect, it, vi } from "vitest";
import { createCompositeProvider } from "@/lib/market-data/composite-provider";
import type { QuoteFxProvider } from "@/lib/market-data/twelve-data-provider";
import type { MetricProvider } from "@/lib/market-data/fmp-provider";

describe("createCompositeProvider", () => {
  const buildProviders = () => {
    const quoteFxProvider: QuoteFxProvider = {
      getQuote: vi.fn().mockResolvedValue({ price: 100, asOf: new Date("2026-08-01") }),
      getFxRate: vi.fn().mockResolvedValue(1.08),
    };
    const metricProvider: MetricProvider = {
      getMetric: vi.fn().mockResolvedValue({ value: 14.7, asOfDate: new Date("2026-08-01") }),
    };

    return { quoteFxProvider, metricProvider };
  };

  it("delegates getQuote to the quote/FX provider", async () => {
    const { quoteFxProvider, metricProvider } = buildProviders();
    const provider = createCompositeProvider(quoteFxProvider, metricProvider);

    const quote = await provider.getQuote("TSM.US");

    expect(quote).toEqual({ price: 100, asOf: new Date("2026-08-01") });
    expect(quoteFxProvider.getQuote).toHaveBeenCalledWith("TSM.US");
  });

  it("delegates getFxRate to the quote/FX provider", async () => {
    const { quoteFxProvider, metricProvider } = buildProviders();
    const provider = createCompositeProvider(quoteFxProvider, metricProvider);

    const rate = await provider.getFxRate("EUR", "USD");

    expect(rate).toBe(1.08);
    expect(quoteFxProvider.getFxRate).toHaveBeenCalledWith("EUR", "USD");
  });

  it("delegates getMetric to the metric provider", async () => {
    const { quoteFxProvider, metricProvider } = buildProviders();
    const provider = createCompositeProvider(quoteFxProvider, metricProvider);

    const metric = await provider.getMetric?.("TSM.US", "roic");

    expect(metric).toEqual({ value: 14.7, asOfDate: new Date("2026-08-01") });
    expect(metricProvider.getMetric).toHaveBeenCalledWith("TSM.US", "roic");
  });
});

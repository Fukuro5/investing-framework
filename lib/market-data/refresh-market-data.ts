import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BASE_CURRENCY } from "@/lib/dashboard/consts";
import type { MarketDataProvider } from "@/lib/market-data/types";

export interface RefreshMarketDataResult {
  updatedPriceCount: number;
  failedPriceTickers: string[];
  updatedFxCount: number;
  failedFxCurrencies: string[];
  updatedMetricCount: number;
  failedMetrics: string[];
}

const refreshPrices = async (provider: MarketDataProvider, db: PrismaClient) => {
  const instruments = await db.instrument.findMany();
  let updatedPriceCount = 0;
  const failedPriceTickers: string[] = [];

  for (const instrument of instruments) {
    try {
      const quote = await provider.getQuote(instrument.ticker);
      await db.priceSnapshot.upsert({
        where: { instrumentId_date: { instrumentId: instrument.id, date: quote.asOf } },
        update: { price: quote.price },
        create: { instrumentId: instrument.id, date: quote.asOf, price: quote.price },
      });
      updatedPriceCount += 1;
    } catch {
      failedPriceTickers.push(instrument.ticker);
    }
  }

  return { updatedPriceCount, failedPriceTickers };
};

const refreshFxRates = async (provider: MarketDataProvider, db: PrismaClient) => {
  const instruments = await db.instrument.findMany();
  const nonUsdCurrencies = [...new Set(instruments.map((instrument) => instrument.currency))].filter(
    (currency) => currency !== BASE_CURRENCY,
  );

  let updatedFxCount = 0;
  const failedFxCurrencies: string[] = [];

  for (const currency of nonUsdCurrencies) {
    try {
      const rate = await provider.getFxRate(currency, BASE_CURRENCY);
      await db.fxRateSnapshot.upsert({
        where: { baseCurrency_quoteCurrency: { baseCurrency: currency, quoteCurrency: BASE_CURRENCY } },
        update: { rate },
        create: { baseCurrency: currency, quoteCurrency: BASE_CURRENCY, rate },
      });
      updatedFxCount += 1;
    } catch {
      failedFxCurrencies.push(currency);
    }
  }

  return { updatedFxCount, failedFxCurrencies };
};

// Only metric keys actually referenced by an active GroupRule are fetched
// — an unbounded "every metric key anyone's ever typed" refresh would burn
// through Finnhub's free-tier rate limit for keys nothing currently uses.
const refreshMetrics = async (provider: MarketDataProvider, db: PrismaClient) => {
  let updatedMetricCount = 0;
  const failedMetrics: string[] = [];

  if (!provider.getMetric) {
    return { updatedMetricCount, failedMetrics };
  }

  const [instruments, activeRules] = await Promise.all([
    db.instrument.findMany(),
    db.groupRule.findMany({ where: { isActive: true }, select: { metricKey: true } }),
  ]);
  const metricKeys = [...new Set(activeRules.map((rule) => rule.metricKey))];

  for (const instrument of instruments) {
    for (const metricKey of metricKeys) {
      try {
        const metric = await provider.getMetric(instrument.ticker, metricKey);
        if (!metric) {
          continue;
        }

        await db.metricValue.upsert({
          where: {
            instrumentId_metricKey_source_asOfDate: {
              instrumentId: instrument.id,
              metricKey,
              source: "api",
              asOfDate: metric.asOfDate,
            },
          },
          update: { value: metric.value },
          create: { instrumentId: instrument.id, metricKey, value: metric.value, asOfDate: metric.asOfDate, source: "api" },
        });
        updatedMetricCount += 1;
      } catch {
        failedMetrics.push(`${instrument.ticker}:${metricKey}`);
      }
    }
  }

  return { updatedMetricCount, failedMetrics };
};

// The one "refresh" action behind the market-data button (PLANNING.md §6):
// fetches a quote per known instrument, an FX rate per non-USD currency in
// use, and a metric value per (instrument, active-rule metric key), caching
// all three as PriceSnapshot/FxRateSnapshot/MetricValue rows so normal page
// loads keep reading from the DB, never calling the provider live.
export const refreshMarketData = async (
  provider: MarketDataProvider,
  db: PrismaClient = prisma,
): Promise<RefreshMarketDataResult> => {
  const [prices, fxRates, metrics] = await Promise.all([
    refreshPrices(provider, db),
    refreshFxRates(provider, db),
    refreshMetrics(provider, db),
  ]);

  return { ...prices, ...fxRates, ...metrics };
};

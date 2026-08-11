import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BASE_CURRENCY } from "@/lib/dashboard/consts";
import type { MarketDataProvider } from "@/lib/market-data/types";

export interface RefreshMarketDataResult {
  updatedPriceCount: number;
  failedPriceTickers: string[];
  updatedFxCount: number;
  failedFxCurrencies: string[];
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

// The one "refresh" action behind the market-data button (PLANNING.md §6):
// fetches a quote per known instrument and an FX rate per non-USD currency
// in use, caching both as PriceSnapshot/FxRateSnapshot rows so normal page
// loads keep reading from the DB, never calling the provider live.
export const refreshMarketData = async (
  provider: MarketDataProvider,
  db: PrismaClient = prisma,
): Promise<RefreshMarketDataResult> => {
  const [prices, fxRates] = await Promise.all([refreshPrices(provider, db), refreshFxRates(provider, db)]);

  return { ...prices, ...fxRates };
};

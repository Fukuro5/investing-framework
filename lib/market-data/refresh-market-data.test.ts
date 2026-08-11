import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import { refreshMarketData } from "@/lib/market-data/refresh-market-data";
import type { MarketDataProvider } from "@/lib/market-data/types";

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(async () => {
  await testDb.cleanup();
});

const seedInstrument = (ticker: string, currency: string) =>
  testDb.prisma.instrument.create({ data: { ticker, name: ticker, assetType: "unknown", currency } });

const buildProvider = (overrides: Partial<MarketDataProvider> = {}): MarketDataProvider => ({
  getQuote: async () => ({ price: 100, asOf: new Date("2026-08-01") }),
  getFxRate: async () => 1.1,
  ...overrides,
});

describe("refreshMarketData", () => {
  it("upserts a PriceSnapshot for every known instrument", async () => {
    await seedInstrument("TSM.US", "USD");
    await seedInstrument("VOD.L", "GBP");

    const result = await refreshMarketData(buildProvider(), testDb.prisma);

    expect(result.updatedPriceCount).toBe(2);
    expect(result.failedPriceTickers).toEqual([]);
    expect(await testDb.prisma.priceSnapshot.count()).toBe(2);
  });

  it("records a failed ticker without failing the rest of the refresh", async () => {
    await seedInstrument("TSM.US", "USD");
    await seedInstrument("BROKEN.US", "USD");

    const provider = buildProvider({
      getQuote: async (ticker) => {
        if (ticker === "BROKEN.US") {
          throw new Error("no data");
        }
        return { price: 100, asOf: new Date("2026-08-01") };
      },
    });

    const result = await refreshMarketData(provider, testDb.prisma);

    expect(result.updatedPriceCount).toBe(1);
    expect(result.failedPriceTickers).toEqual(["BROKEN.US"]);
  });

  it("only fetches FX rates for non-USD currencies", async () => {
    await seedInstrument("TSM.US", "USD");
    await seedInstrument("VOD.L", "GBP");
    const fxCalls: string[] = [];

    const provider = buildProvider({
      getFxRate: async (base) => {
        fxCalls.push(base);
        return 1.27;
      },
    });

    const result = await refreshMarketData(provider, testDb.prisma);

    expect(fxCalls).toEqual(["GBP"]);
    expect(result.updatedFxCount).toBe(1);
    const fxRate = await testDb.prisma.fxRateSnapshot.findFirstOrThrow();
    expect(fxRate).toMatchObject({ baseCurrency: "GBP", quoteCurrency: "USD", rate: 1.27 });
  });

  it("records a failed currency without failing the rest of the refresh", async () => {
    await seedInstrument("VOD.L", "GBP");
    const provider = buildProvider({
      getFxRate: async () => {
        throw new Error("rate limited");
      },
    });

    const result = await refreshMarketData(provider, testDb.prisma);

    expect(result.updatedFxCount).toBe(0);
    expect(result.failedFxCurrencies).toEqual(["GBP"]);
  });

  it("upserts rather than duplicates on a second refresh for the same day", async () => {
    await seedInstrument("TSM.US", "USD");
    const provider = buildProvider();

    await refreshMarketData(provider, testDb.prisma);
    await refreshMarketData(provider, testDb.prisma);

    expect(await testDb.prisma.priceSnapshot.count()).toBe(1);
  });
});

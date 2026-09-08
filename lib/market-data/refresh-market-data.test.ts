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

  it("bumps FxRateSnapshot.fetchedAt on a second refresh even when the rate is unchanged", async () => {
    await seedInstrument("VOD.L", "GBP");
    const provider = buildProvider();

    await refreshMarketData(provider, testDb.prisma);
    const first = await testDb.prisma.fxRateSnapshot.findFirstOrThrow();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await refreshMarketData(provider, testDb.prisma);
    const second = await testDb.prisma.fxRateSnapshot.findFirstOrThrow();

    expect(second.fetchedAt.getTime()).toBeGreaterThan(first.fetchedAt.getTime());
  });

  it("upserts rather than duplicates on a second refresh for the same day", async () => {
    await seedInstrument("TSM.US", "USD");
    const provider = buildProvider();

    await refreshMarketData(provider, testDb.prisma);
    await refreshMarketData(provider, testDb.prisma);

    expect(await testDb.prisma.priceSnapshot.count()).toBe(1);
  });

  it("bumps fetchedAt on a second refresh even when the price is unchanged", async () => {
    await seedInstrument("TSM.US", "USD");
    const provider = buildProvider();

    await refreshMarketData(provider, testDb.prisma);
    const first = await testDb.prisma.priceSnapshot.findFirstOrThrow();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await refreshMarketData(provider, testDb.prisma);
    const second = await testDb.prisma.priceSnapshot.findFirstOrThrow();

    expect(second.fetchedAt.getTime()).toBeGreaterThan(first.fetchedAt.getTime());
  });

  const seedActiveRule = async (metricKey: string) => {
    const framework = await testDb.prisma.framework.create({ data: { name: "Quality" } });
    const group = await testDb.prisma.frameworkGroup.create({
      data: { frameworkId: framework.id, name: "Core", priority: 0 },
    });
    await testDb.prisma.groupRule.create({
      data: { groupId: group.id, type: "metric", metricKey, operator: "gt", threshold: 15, role: "classification", isActive: true },
    });
    return group.id;
  };

  it("only fetches metrics for keys referenced by an active GroupRule", async () => {
    await seedInstrument("TSM.US", "USD");
    await seedActiveRule("roic");
    const metricCalls: string[] = [];

    const provider = buildProvider({
      getMetric: async (_ticker, metricKey) => {
        metricCalls.push(metricKey);
        return { value: 18, asOfDate: new Date("2026-08-01") };
      },
    });

    const result = await refreshMarketData(provider, testDb.prisma);

    expect(metricCalls).toEqual(["roic"]);
    expect(result.updatedMetricCount).toBe(1);
    const metric = await testDb.prisma.metricValue.findFirstOrThrow();
    expect(metric).toMatchObject({ metricKey: "roic", value: 18, source: "api" });
  });

  it("never treats an allocation rule as a metric key to fetch", async () => {
    await seedInstrument("TSM.US", "USD");
    const groupId = await seedActiveRule("roic");
    await testDb.prisma.groupRule.create({
      data: { groupId, type: "allocation", scope: "position", minAllocation: 0, maxAllocation: 15, role: "signal" },
    });
    const metricCalls: string[] = [];

    const provider = buildProvider({
      getMetric: async (_ticker, metricKey) => {
        metricCalls.push(metricKey);
        return { value: 18, asOfDate: new Date("2026-08-01") };
      },
    });

    await refreshMarketData(provider, testDb.prisma);

    expect(metricCalls).toEqual(["roic"]);
  });

  it("does nothing when there are no active rules, without erroring", async () => {
    await seedInstrument("TSM.US", "USD");
    const provider = buildProvider({ getMetric: async () => ({ value: 1, asOfDate: new Date() }) });

    const result = await refreshMarketData(provider, testDb.prisma);

    expect(result.updatedMetricCount).toBe(0);
    expect(await testDb.prisma.metricValue.count()).toBe(0);
  });

  it("does nothing when the provider doesn't implement getMetric", async () => {
    await seedInstrument("TSM.US", "USD");
    await seedActiveRule("roic");
    const provider = buildProvider();
    delete provider.getMetric;

    const result = await refreshMarketData(provider, testDb.prisma);

    expect(result.updatedMetricCount).toBe(0);
    expect(result.failedMetrics).toEqual([]);
  });

  it("records a failed metric fetch without failing the rest of the refresh", async () => {
    await seedInstrument("TSM.US", "USD");
    await seedActiveRule("roic");
    const provider = buildProvider({
      getMetric: async () => {
        throw new Error("rate limited");
      },
    });

    const result = await refreshMarketData(provider, testDb.prisma);

    expect(result.updatedMetricCount).toBe(0);
    expect(result.failedMetrics).toEqual(["TSM.US:roic"]);
  });

  it("bumps MetricValue.fetchedAt on a second refresh even when the value is unchanged", async () => {
    await seedInstrument("TSM.US", "USD");
    await seedActiveRule("roic");
    const provider = buildProvider({
      getMetric: async () => ({ value: 18, asOfDate: new Date("2026-08-01") }),
    });

    await refreshMarketData(provider, testDb.prisma);
    const first = await testDb.prisma.metricValue.findFirstOrThrow();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await refreshMarketData(provider, testDb.prisma);
    const second = await testDb.prisma.metricValue.findFirstOrThrow();

    expect(second.fetchedAt.getTime()).toBeGreaterThan(first.fetchedAt.getTime());
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshMarketDataAction, type RefreshMarketDataState } from "@/app/[locale]/actions";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import type { MarketDataProvider } from "@/lib/market-data/types";

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(async () => {
  await testDb.cleanup();
  vi.unstubAllEnvs();
});

const seedInstrument = (ticker: string) =>
  testDb.prisma.instrument.create({ data: { ticker, name: ticker, assetType: "unknown", currency: "USD" } });

// classifyInstruments only considers instruments with an open position
// (via getPositions), so the classification tests need a full
// broker/account/importBatch/positionSnapshot chain, not just an Instrument.
const seedPosition = async (ticker: string) => {
  const broker = await testDb.prisma.broker.upsert({
    where: { name: "freedom-finance" },
    update: {},
    create: { name: "freedom-finance" },
  });
  const account = await testDb.prisma.account.upsert({
    where: { brokerId_label: { brokerId: broker.id, label: "Freedom Finance 000" } },
    update: {},
    create: { brokerId: broker.id, label: "Freedom Finance 000", baseCurrency: "USD" },
  });
  const importBatch = await testDb.prisma.importBatch.create({
    data: { accountId: account.id, fileName: "s.json", fileType: "application/json", status: "completed" },
  });
  const instrument = await seedInstrument(ticker);
  await testDb.prisma.positionSnapshot.create({
    data: {
      accountId: account.id,
      instrumentId: instrument.id,
      importBatchId: importBatch.id,
      asOfDate: new Date("2026-07-31"),
      quantity: 1,
      avgCostPrice: 100,
      marketPrice: 0,
      marketValue: 0,
      unrealizedPnl: 0,
      currency: "USD",
    },
  });

  return instrument;
};

const buildProvider = (overrides: Partial<MarketDataProvider> = {}): MarketDataProvider => ({
  getQuote: async () => ({ price: 100, asOf: new Date("2026-08-01") }),
  getFxRate: async () => 1,
  ...overrides,
});

describe("refreshMarketDataAction", () => {
  it("returns success with the refresh result when no active framework exists", async () => {
    await seedInstrument("TSM.US");

    const state = await refreshMarketDataAction(
      { status: "idle" } as RefreshMarketDataState,
      new FormData(),
      testDb.prisma,
      buildProvider(),
    );

    expect(state).toMatchObject({ status: "success", updatedPriceCount: 1, failedPriceTickers: [] });
  });

  it("re-classifies the active framework's instruments after a successful refresh", async () => {
    const instrument = await seedPosition("TSM.US");
    await testDb.prisma.metricValue.create({
      data: { instrumentId: instrument.id, metricKey: "roic", value: 20, asOfDate: new Date("2026-08-01"), source: "manual" },
    });
    const framework = await testDb.prisma.framework.create({ data: { name: "Quality", isActive: true } });
    const group = await testDb.prisma.frameworkGroup.create({
      data: { frameworkId: framework.id, name: "Core", priority: 0 },
    });
    await testDb.prisma.groupRule.create({
      data: { groupId: group.id, type: "metric", metricKey: "roic", operator: "gt", threshold: 15, role: "classification", isActive: true },
    });

    await refreshMarketDataAction(
      { status: "idle" } as RefreshMarketDataState,
      new FormData(),
      testDb.prisma,
      buildProvider(),
    );

    const assignment = await testDb.prisma.instrumentGroupAssignment.findUniqueOrThrow({
      where: { frameworkId_instrumentId: { frameworkId: framework.id, instrumentId: instrument.id } },
    });
    expect(assignment).toMatchObject({ groupId: group.id, source: "auto" });
  });

  it("does not classify when no framework is active", async () => {
    await seedPosition("TSM.US");

    const state = await refreshMarketDataAction(
      { status: "idle" } as RefreshMarketDataState,
      new FormData(),
      testDb.prisma,
      buildProvider(),
    );

    expect(state.status).toBe("success");
    expect(await testDb.prisma.instrumentGroupAssignment.count()).toBe(0);
  });

  it("returns a missingApiKey error when no provider is given and FINNHUB_API_KEY is unset", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "");

    const state = await refreshMarketDataAction(
      { status: "idle" } as RefreshMarketDataState,
      new FormData(),
      testDb.prisma,
      undefined,
    );

    expect(state).toEqual({ status: "error", errorKey: "missingApiKey" });
  });

  it("returns a genericRefreshError when classification itself fails", async () => {
    const instrument = await seedPosition("TSM.US");
    await testDb.prisma.metricValue.create({
      data: { instrumentId: instrument.id, metricKey: "roic", value: 20, asOfDate: new Date("2026-08-01"), source: "manual" },
    });
    const framework = await testDb.prisma.framework.create({ data: { name: "Quality", isActive: true } });
    const group = await testDb.prisma.frameworkGroup.create({
      data: { frameworkId: framework.id, name: "Core", priority: 0 },
    });
    // An operator this malformed can only reach the DB by bypassing the
    // CRUD UI's validation — used here purely to force classifyInstruments
    // to throw so the action's catch-all error path is exercised.
    await testDb.prisma.groupRule.create({
      data: {
        groupId: group.id,
        type: "metric",
        metricKey: "roic",
        operator: "not-a-real-operator",
        threshold: 15,
        role: "classification",
        isActive: true,
      },
    });

    const state = await refreshMarketDataAction(
      { status: "idle" } as RefreshMarketDataState,
      new FormData(),
      testDb.prisma,
      buildProvider(),
    );

    expect(state).toEqual({ status: "error", errorKey: "genericRefreshError" });
  });
});

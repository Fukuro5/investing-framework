import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assignInstrument } from "@/lib/frameworks/assign-instrument";
import { createFramework } from "@/lib/frameworks/create-framework";
import { createGroup } from "@/lib/frameworks/create-group";
import { createRule } from "@/lib/frameworks/create-rule";
import { setActiveFramework } from "@/lib/frameworks/set-active-framework";
import { getActiveFrameworkPositionSignals } from "@/lib/signals/get-active-framework-position-signals";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(async () => {
  await testDb.cleanup();
});

const seedPosition = async (ticker: string, marketValue: number) => {
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
  const instrument = await testDb.prisma.instrument.create({
    data: { ticker, name: ticker, assetType: "unknown", currency: "USD" },
  });
  await testDb.prisma.positionSnapshot.create({
    data: {
      accountId: account.id,
      instrumentId: instrument.id,
      importBatchId: importBatch.id,
      asOfDate: new Date("2026-07-31"),
      quantity: 1,
      avgCostPrice: marketValue,
      marketPrice: 0,
      marketValue: 0,
      unrealizedPnl: 0,
      currency: "USD",
    },
  });
  await testDb.prisma.priceSnapshot.create({
    data: { instrumentId: instrument.id, date: new Date("2026-08-01"), price: marketValue },
  });

  return instrument;
};

describe("getActiveFrameworkPositionSignals", () => {
  it("returns null when no framework is active", async () => {
    expect(await getActiveFrameworkPositionSignals(testDb.prisma)).toBeNull();
  });

  it("omits positions with no group assignment for the active framework", async () => {
    await seedPosition("TSM.US", 100);
    const framework = await createFramework({ name: "Quality", description: null }, testDb.prisma);
    await createGroup({ frameworkId: framework.id, name: "Core", targetAllocationMin: 0, targetAllocationMax: 100, priority: 0 }, testDb.prisma);
    await setActiveFramework(framework.id, testDb.prisma);

    const result = await getActiveFrameworkPositionSignals(testDb.prisma);

    expect(result?.signalByInstrumentId.size).toBe(0);
  });

  it("computes sell when a signal metric rule breaches on 3+ metrics, regardless of allocation", async () => {
    const instrument = await seedPosition("TSM.US", 100);
    const framework = await createFramework({ name: "Quality", description: null }, testDb.prisma);
    const core = await createGroup(
      { frameworkId: framework.id, name: "Core", targetAllocationMin: 0, targetAllocationMax: 100, priority: 0 },
      testDb.prisma,
    );
    await createRule({ groupId: core.id, type: "metric", metricKey: "roic", operator: "gt", threshold: 15, role: "signal" }, testDb.prisma);
    await createRule({ groupId: core.id, type: "metric", metricKey: "fcf", operator: "gt", threshold: 0, role: "signal" }, testDb.prisma);
    await createRule(
      { groupId: core.id, type: "metric", metricKey: "peRatio", operator: "lt", threshold: 20, role: "signal" },
      testDb.prisma,
    );
    await testDb.prisma.metricValue.createMany({
      data: [
        { instrumentId: instrument.id, metricKey: "roic", value: 5, asOfDate: new Date("2026-08-01"), source: "manual" },
        { instrumentId: instrument.id, metricKey: "fcf", value: -1, asOfDate: new Date("2026-08-01"), source: "manual" },
        { instrumentId: instrument.id, metricKey: "peRatio", value: 30, asOfDate: new Date("2026-08-01"), source: "manual" },
      ],
    });
    await setActiveFramework(framework.id, testDb.prisma);
    await assignInstrument({ frameworkId: framework.id, groupId: core.id, instrumentId: instrument.id }, testDb.prisma);

    const result = await getActiveFrameworkPositionSignals(testDb.prisma);
    const signal = result?.signalByInstrumentId.get(instrument.id);

    expect(signal?.metricSeverity).toBe("bad");
    expect(signal?.underperformingMetricKeys.sort()).toEqual(["fcf", "peRatio", "roic"]);
    expect(signal?.badge).toBe("sell");
  });

  it("computes trim when a healthy position is over its position allocation band", async () => {
    const instrument = await seedPosition("TSM.US", 100);
    const framework = await createFramework({ name: "Quality", description: null }, testDb.prisma);
    const core = await createGroup(
      { frameworkId: framework.id, name: "Core", targetAllocationMin: 0, targetAllocationMax: 100, priority: 0 },
      testDb.prisma,
    );
    await createRule({ groupId: core.id, type: "allocation", minAllocation: 0, maxAllocation: 5 }, testDb.prisma);
    await setActiveFramework(framework.id, testDb.prisma);
    await assignInstrument({ frameworkId: framework.id, groupId: core.id, instrumentId: instrument.id }, testDb.prisma);

    const result = await getActiveFrameworkPositionSignals(testDb.prisma);
    const signal = result?.signalByInstrumentId.get(instrument.id);

    expect(signal?.allocationAction).toBe("over");
    expect(signal?.allocationBand).toEqual({ minAllocation: 0, maxAllocation: 5 });
    expect(signal?.badge).toBe("trim");
  });
});

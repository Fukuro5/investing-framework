import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assignInstrument } from "@/lib/frameworks/assign-instrument";
import { createFramework } from "@/lib/frameworks/create-framework";
import { createGroup } from "@/lib/frameworks/create-group";
import { getActiveFrameworkAllocations } from "@/lib/frameworks/get-group-allocations";
import { setActiveFramework } from "@/lib/frameworks/set-active-framework";
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

describe("getActiveFrameworkAllocations", () => {
  it("returns null when no framework is active", async () => {
    expect(await getActiveFrameworkAllocations(testDb.prisma)).toBeNull();
  });

  it("sums assigned positions' allocation into their group and leaves unassigned ones as unclassified", async () => {
    const coreInstrument = await seedPosition("TSM.US", 600);
    await seedPosition("O.US", 400);

    const framework = await createFramework({ name: "Quality", description: null }, testDb.prisma);
    const core = await createGroup(
      { frameworkId: framework.id, name: "Core", targetAllocationMin: 50, targetAllocationMax: 70, priority: 0 },
      testDb.prisma,
    );
    await createGroup(
      { frameworkId: framework.id, name: "Convexity", targetAllocationMin: 30, targetAllocationMax: 50, priority: 1 },
      testDb.prisma,
    );
    await setActiveFramework(framework.id, testDb.prisma);
    await assignInstrument({ frameworkId: framework.id, groupId: core.id, instrumentId: coreInstrument.id }, testDb.prisma);

    const result = await getActiveFrameworkAllocations(testDb.prisma);

    expect(result?.framework.name).toBe("Quality");
    const coreResult = result?.groups.find((group) => group.name === "Core");
    const convexityResult = result?.groups.find((group) => group.name === "Convexity");
    expect(coreResult?.currentAllocationPercent).toBeCloseTo(60);
    expect(convexityResult?.currentAllocationPercent).toBe(0);
    expect(result?.unclassifiedAllocationPercent).toBeCloseTo(40);
  });
});

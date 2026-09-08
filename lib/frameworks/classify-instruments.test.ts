import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { classifyInstruments } from "@/lib/frameworks/classify-instruments";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

let testDb: TestDb;
let frameworkId: string;

beforeEach(async () => {
  testDb = createTestDb();
  const framework = await testDb.prisma.framework.create({ data: { name: "Quality" } });
  frameworkId = framework.id;
});

afterEach(async () => {
  await testDb.cleanup();
});

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
      avgCostPrice: 100,
      marketPrice: 0,
      marketValue: 0,
      unrealizedPnl: 0,
      currency: "USD",
    },
  });

  return instrument;
};

const seedMetric = (instrumentId: string, metricKey: string, value: number) =>
  testDb.prisma.metricValue.create({
    data: { instrumentId, metricKey, value, asOfDate: new Date("2026-07-31"), source: "manual" },
  });

const seedGroup = (name: string, priority: number) =>
  testDb.prisma.frameworkGroup.create({
    data: { frameworkId, name, priority },
  });

const seedRule = (groupId: string, metricKey: string, operator: string, threshold: number) =>
  testDb.prisma.groupRule.create({
    data: { groupId, type: "metric", metricKey, operator, threshold, role: "classification", isActive: true },
  });

describe("classifyInstruments", () => {
  it("auto-assigns an instrument that matches a group's classification rules", async () => {
    const instrument = await seedPosition("TSM.US");
    await seedMetric(instrument.id, "roic", 20);
    const core = await seedGroup("Core", 0);
    await seedRule(core.id, "roic", "gt", 15);

    const result = await classifyInstruments(frameworkId, testDb.prisma);

    expect(result.classifiedCount).toBe(1);
    const assignment = await testDb.prisma.instrumentGroupAssignment.findUniqueOrThrow({
      where: { frameworkId_instrumentId: { frameworkId, instrumentId: instrument.id } },
    });
    expect(assignment).toMatchObject({ groupId: core.id, source: "auto" });
  });

  it("never overwrites an existing manual assignment, even if it would match a different group", async () => {
    const instrument = await seedPosition("TSM.US");
    await seedMetric(instrument.id, "roic", 20);
    const core = await seedGroup("Core", 0);
    await seedRule(core.id, "roic", "gt", 15);
    const convexity = await seedGroup("Convexity", 1);
    await testDb.prisma.instrumentGroupAssignment.create({
      data: { frameworkId, groupId: convexity.id, instrumentId: instrument.id, source: "manual" },
    });

    const result = await classifyInstruments(frameworkId, testDb.prisma);

    expect(result.classifiedCount).toBe(0);
    const assignment = await testDb.prisma.instrumentGroupAssignment.findUniqueOrThrow({
      where: { frameworkId_instrumentId: { frameworkId, instrumentId: instrument.id } },
    });
    expect(assignment).toMatchObject({ groupId: convexity.id, source: "manual" });
  });

  it("breaks a tie between two matching groups using the lower priority number", async () => {
    const instrument = await seedPosition("TSM.US");
    await seedMetric(instrument.id, "roic", 20);
    const lowPriority = await seedGroup("Low priority number", 0);
    await seedRule(lowPriority.id, "roic", "gt", 15);
    const highPriority = await seedGroup("High priority number", 1);
    await seedRule(highPriority.id, "roic", "gt", 15);

    await classifyInstruments(frameworkId, testDb.prisma);

    const assignment = await testDb.prisma.instrumentGroupAssignment.findUniqueOrThrow({
      where: { frameworkId_instrumentId: { frameworkId, instrumentId: instrument.id } },
    });
    expect(assignment.groupId).toBe(lowPriority.id);
  });

  it("leaves an instrument unclassified when no group's rules match", async () => {
    const instrument = await seedPosition("TSM.US");
    await seedMetric(instrument.id, "roic", 5);
    const core = await seedGroup("Core", 0);
    await seedRule(core.id, "roic", "gt", 15);

    const result = await classifyInstruments(frameworkId, testDb.prisma);

    expect(result.classifiedCount).toBe(0);
    expect(await testDb.prisma.instrumentGroupAssignment.count()).toBe(0);
  });

  it("never matches a group with zero active classification rules", async () => {
    const instrument = await seedPosition("TSM.US");
    await seedMetric(instrument.id, "roic", 20);
    await seedGroup("Empty group", 0);

    const result = await classifyInstruments(frameworkId, testDb.prisma);

    expect(result.classifiedCount).toBe(0);
  });

  it("treats a missing metric value as not matching (warn, not a false pass)", async () => {
    await seedPosition("TSM.US");
    // No MetricValue seeded for "roic" at all.
    const core = await seedGroup("Core", 0);
    await seedRule(core.id, "roic", "gt", 15);

    const result = await classifyInstruments(frameworkId, testDb.prisma);

    expect(result.classifiedCount).toBe(0);
  });

  it("ignores an inactive classification rule", async () => {
    const instrument = await seedPosition("TSM.US");
    await seedMetric(instrument.id, "roic", 20);
    const core = await seedGroup("Core", 0);
    const rule = await seedRule(core.id, "roic", "gt", 15);
    await testDb.prisma.groupRule.update({ where: { id: rule.id }, data: { isActive: false } });

    const result = await classifyInstruments(frameworkId, testDb.prisma);

    expect(result.classifiedCount).toBe(0);
  });

  it("never treats an allocation rule as a classification rule", async () => {
    const instrument = await seedPosition("TSM.US");
    await seedMetric(instrument.id, "roic", 20);
    const core = await seedGroup("Core", 0);
    await testDb.prisma.groupRule.create({
      data: { groupId: core.id, type: "allocation", scope: "group", minAllocation: 0, maxAllocation: 100, role: "signal" },
    });

    const result = await classifyInstruments(frameworkId, testDb.prisma);

    expect(result.classifiedCount).toBe(0);
    expect(await testDb.prisma.instrumentGroupAssignment.count()).toBe(0);
  });
});

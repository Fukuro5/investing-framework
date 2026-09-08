import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import { upsertTrendMetric } from "@/lib/edgar/upsert-trend-metric";

describe("upsertTrendMetric", () => {
  let testDb: TestDb;
  let instrumentId: string;

  beforeEach(async () => {
    testDb = createTestDb();
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "AAPL.US", name: "Apple", assetType: "equity", currency: "USD" },
    });
    instrumentId = instrument.id;
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  it("creates a MetricValue row with the api source and edgarFinancialsTrend key", async () => {
    await upsertTrendMetric(instrumentId, { verdict: "improving", value: 1, asOfDate: new Date("2026-06-27") }, testDb.prisma);

    const rows = await testDb.prisma.metricValue.findMany({ where: { instrumentId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ metricKey: "edgarFinancialsTrend", source: "api", value: 1 });
  });

  it("updates the existing row instead of creating a second one for the same asOfDate", async () => {
    await upsertTrendMetric(instrumentId, { verdict: "improving", value: 1, asOfDate: new Date("2026-06-27") }, testDb.prisma);
    await upsertTrendMetric(instrumentId, { verdict: "deteriorating", value: -1, asOfDate: new Date("2026-06-27") }, testDb.prisma);

    const rows = await testDb.prisma.metricValue.findMany({ where: { instrumentId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(-1);
  });

  it("does not clobber a manual metric row sharing the same key but a different source", async () => {
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "edgarFinancialsTrend", value: 1, asOfDate: new Date("2026-06-27"), source: "manual" },
    });

    await upsertTrendMetric(instrumentId, { verdict: "deteriorating", value: -1, asOfDate: new Date("2026-06-27") }, testDb.prisma);

    const rows = await testDb.prisma.metricValue.findMany({ where: { instrumentId }, orderBy: { source: "asc" } });
    expect(rows).toHaveLength(2);
  });
});

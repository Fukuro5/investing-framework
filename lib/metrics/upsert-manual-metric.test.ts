import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import { upsertManualMetric } from "@/lib/metrics/upsert-manual-metric";

let testDb: TestDb;
let instrumentId: string;

beforeEach(async () => {
  testDb = createTestDb();
  const instrument = await testDb.prisma.instrument.create({
    data: { ticker: "TSM.US", name: "TSM", assetType: "unknown", currency: "USD" },
  });
  instrumentId = instrument.id;
});

afterEach(async () => {
  await testDb.cleanup();
});

describe("upsertManualMetric", () => {
  it("creates a manual MetricValue row", async () => {
    const metric = await upsertManualMetric(
      { instrumentId, metricKey: "  roic  ", value: 18.5, asOfDate: new Date("2026-06-01") },
      testDb.prisma,
    );

    expect(metric).toMatchObject({ metricKey: "roic", value: 18.5, source: "manual" });
  });

  it("throws for a blank metric key", async () => {
    await expect(
      upsertManualMetric({ instrumentId, metricKey: "  ", value: 1, asOfDate: new Date() }, testDb.prisma),
    ).rejects.toThrow(/Metric key is required/);
  });

  it("updates the value instead of duplicating when the same instrument/key/asOfDate is submitted again", async () => {
    const asOfDate = new Date("2026-06-01");
    await upsertManualMetric({ instrumentId, metricKey: "roic", value: 18.5, asOfDate }, testDb.prisma);
    await upsertManualMetric({ instrumentId, metricKey: "roic", value: 19.2, asOfDate }, testDb.prisma);

    const rows = await testDb.prisma.metricValue.findMany({ where: { instrumentId, metricKey: "roic" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(19.2);
  });

  it("keeps both rows when submitted for a different asOfDate", async () => {
    await upsertManualMetric({ instrumentId, metricKey: "roic", value: 18.5, asOfDate: new Date("2026-05-01") }, testDb.prisma);
    await upsertManualMetric({ instrumentId, metricKey: "roic", value: 19.2, asOfDate: new Date("2026-06-01") }, testDb.prisma);

    expect(await testDb.prisma.metricValue.count({ where: { instrumentId, metricKey: "roic" } })).toBe(2);
  });

  it("bumps fetchedAt when re-submitting the same instrument/key/asOfDate", async () => {
    const asOfDate = new Date("2026-06-01");
    const first = await upsertManualMetric({ instrumentId, metricKey: "roic", value: 18.5, asOfDate }, testDb.prisma);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await upsertManualMetric({ instrumentId, metricKey: "roic", value: 19.2, asOfDate }, testDb.prisma);

    expect(second.fetchedAt.getTime()).toBeGreaterThan(first.fetchedAt.getTime());
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import { listInstrumentMetrics } from "@/lib/metrics/list-instrument-metrics";

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

describe("listInstrumentMetrics", () => {
  it("flags exactly one row per metricKey as current — the one resolveMetricValue would pick", async () => {
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "roic", value: 10, asOfDate: new Date("2026-01-01"), source: "manual" },
    });
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "roic", value: 15, asOfDate: new Date("2026-06-01"), source: "api" },
    });
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "fcf", value: 500, asOfDate: new Date("2026-06-01"), source: "manual" },
    });

    const rows = await listInstrumentMetrics(instrumentId, testDb.prisma);

    const roicRows = rows.filter((row) => row.metricKey === "roic");
    expect(roicRows).toHaveLength(2);
    expect(roicRows.find((row) => row.isCurrent)).toMatchObject({ value: 15 });

    const fcfRows = rows.filter((row) => row.metricKey === "fcf");
    expect(fcfRows).toHaveLength(1);
    expect(fcfRows[0].isCurrent).toBe(true);
  });

  it("returns an empty list when the instrument has no metrics yet", async () => {
    expect(await listInstrumentMetrics(instrumentId, testDb.prisma)).toEqual([]);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import { resolveMetricValue } from "@/lib/metrics/resolve-metric-value";

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

describe("resolveMetricValue", () => {
  it("returns null when no MetricValue rows exist for this instrument+metricKey", async () => {
    expect(await resolveMetricValue(instrumentId, "roic", testDb.prisma)).toBeNull();
  });

  it("prefers the row with the more recent asOfDate, regardless of source", async () => {
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "roic", value: 10, asOfDate: new Date("2026-01-01"), source: "manual" },
    });
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "roic", value: 15, asOfDate: new Date("2026-06-01"), source: "api" },
    });

    const resolved = await resolveMetricValue(instrumentId, "roic", testDb.prisma);

    expect(resolved).toMatchObject({ value: 15, source: "api" });
  });

  it("lets a fresher manual correction override a stale api value", async () => {
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "roic", value: 15, asOfDate: new Date("2026-01-01"), source: "api" },
    });
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "roic", value: 20, asOfDate: new Date("2026-06-01"), source: "manual" },
    });

    const resolved = await resolveMetricValue(instrumentId, "roic", testDb.prisma);

    expect(resolved).toMatchObject({ value: 20, source: "manual" });
  });

  it("breaks an asOfDate tie using the more recently fetched row", async () => {
    // Two different sources so both rows can share the same asOfDate — the
    // unique constraint is (instrumentId, metricKey, source, asOfDate), so
    // two rows with the same source can never tie on asOfDate anyway.
    const asOfDate = new Date("2026-06-01");
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "roic", value: 10, asOfDate, source: "api", fetchedAt: new Date("2026-06-01T09:00:00Z") },
    });
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "roic", value: 12, asOfDate, source: "manual", fetchedAt: new Date("2026-06-01T15:00:00Z") },
    });

    const resolved = await resolveMetricValue(instrumentId, "roic", testDb.prisma);

    expect(resolved?.value).toBe(12);
  });

  it("is scoped per metricKey — doesn't mix up different metrics for the same instrument", async () => {
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "roic", value: 15, asOfDate: new Date("2026-06-01"), source: "manual" },
    });
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "fcf", value: 500, asOfDate: new Date("2026-06-01"), source: "manual" },
    });

    expect((await resolveMetricValue(instrumentId, "roic", testDb.prisma))?.value).toBe(15);
    expect((await resolveMetricValue(instrumentId, "fcf", testDb.prisma))?.value).toBe(500);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import { getInstrumentEdgarStatus } from "@/lib/edgar/get-instrument-edgar-status";

describe("getInstrumentEdgarStatus", () => {
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

  it("returns nulls when the instrument has never been checked", async () => {
    const status = await getInstrumentEdgarStatus(instrumentId, testDb.prisma);

    expect(status).toEqual({ lastCheckedFilingDate: null, verdict: null });
  });

  it("returns the last-checked date and the verdict label mapped from the latest trend metric", async () => {
    await testDb.prisma.instrument.update({ where: { id: instrumentId }, data: { lastCheckedFilingDate: new Date("2026-07-31") } });
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "edgarFinancialsTrend", value: 1, asOfDate: new Date("2026-06-27"), source: "api" },
    });

    const status = await getInstrumentEdgarStatus(instrumentId, testDb.prisma);

    expect(status).toEqual({ lastCheckedFilingDate: new Date("2026-07-31"), verdict: "improving" });
  });

  it("prefers a fresher manual override over an older api verdict", async () => {
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "edgarFinancialsTrend", value: 1, asOfDate: new Date("2026-06-27"), source: "api" },
    });
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "edgarFinancialsTrend", value: -1, asOfDate: new Date("2026-08-01"), source: "manual" },
    });

    const status = await getInstrumentEdgarStatus(instrumentId, testDb.prisma);

    expect(status.verdict).toBe("deteriorating");
  });
});

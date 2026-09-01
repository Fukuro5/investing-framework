import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import { getLatestThesisVerdict } from "@/lib/thesis/get-latest-thesis-verdict";

describe("getLatestThesisVerdict", () => {
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

  it("returns null when no verdict has been recorded", async () => {
    await expect(getLatestThesisVerdict(instrumentId, testDb.prisma)).resolves.toBeNull();
  });

  it("returns the verdict with the latest asOfDate across multiple filings", async () => {
    await testDb.prisma.thesisVerdict.create({
      data: { instrumentId, accessionNumber: "acc-1", verdict: "holding", explanation: "Older", asOfDate: new Date("2026-01-01") },
    });
    await testDb.prisma.thesisVerdict.create({
      data: { instrumentId, accessionNumber: "acc-2", verdict: "broken", explanation: "Newer", asOfDate: new Date("2026-07-01") },
    });

    await expect(getLatestThesisVerdict(instrumentId, testDb.prisma)).resolves.toEqual({ verdict: "broken", explanation: "Newer" });
  });

  it("returns null instead of crashing when a stored verdict is outside the known set", async () => {
    await testDb.prisma.thesisVerdict.create({
      data: { instrumentId, accessionNumber: "acc-1", verdict: "uncertain", explanation: "Bad data", asOfDate: new Date("2026-01-01") },
    });

    await expect(getLatestThesisVerdict(instrumentId, testDb.prisma)).resolves.toBeNull();
  });
});

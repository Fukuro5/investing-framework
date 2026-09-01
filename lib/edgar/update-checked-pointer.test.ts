import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import { updateCheckedPointer } from "@/lib/edgar/update-checked-pointer";
import type { TrackedFiling } from "@/lib/edgar/get-latest-tracked-filing";

describe("updateCheckedPointer", () => {
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

  it("persists the filing date and accession number onto the instrument", async () => {
    const filing: TrackedFiling = { form: "10-Q", filingDate: "2026-07-31", accessionNumber: "0000320193-26-000020", primaryDocument: "x.htm" };

    await updateCheckedPointer(instrumentId, filing, testDb.prisma);

    const updated = await testDb.prisma.instrument.findUniqueOrThrow({ where: { id: instrumentId } });
    expect(updated.lastCheckedFilingDate).toEqual(new Date("2026-07-31"));
    expect(updated.lastCheckedAccessionNumber).toBe("0000320193-26-000020");
  });
});

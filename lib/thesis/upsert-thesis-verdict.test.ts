import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import type { TrackedFiling } from "@/lib/edgar/get-latest-tracked-filing";
import { upsertThesisVerdict } from "@/lib/thesis/upsert-thesis-verdict";

const filing = (accessionNumber: string): TrackedFiling => ({
  form: "10-Q",
  filingDate: "2026-07-31",
  accessionNumber,
  primaryDocument: "doc.htm",
});

describe("upsertThesisVerdict", () => {
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

  it("creates a row for a new (instrumentId, accessionNumber) pair", async () => {
    await upsertThesisVerdict(instrumentId, filing("0000320193-26-000020"), { verdict: "holding", explanation: "Still on track." }, testDb.prisma);

    const rows = await testDb.prisma.thesisVerdict.findMany({ where: { instrumentId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ verdict: "holding", explanation: "Still on track.", accessionNumber: "0000320193-26-000020" });
  });

  it("updates the row in place for the same accession number", async () => {
    const accn = "0000320193-26-000020";
    await upsertThesisVerdict(instrumentId, filing(accn), { verdict: "holding", explanation: "Still on track." }, testDb.prisma);
    await upsertThesisVerdict(instrumentId, filing(accn), { verdict: "broken", explanation: "Margins collapsed." }, testDb.prisma);

    const rows = await testDb.prisma.thesisVerdict.findMany({ where: { instrumentId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ verdict: "broken", explanation: "Margins collapsed." });
  });

  it("creates a second row for a distinct accession number, keeping history", async () => {
    await upsertThesisVerdict(instrumentId, filing("0000320193-26-000020"), { verdict: "holding", explanation: "A" }, testDb.prisma);
    await upsertThesisVerdict(instrumentId, filing("0000320193-26-000021"), { verdict: "partiallyWeakening", explanation: "B" }, testDb.prisma);

    const rows = await testDb.prisma.thesisVerdict.findMany({ where: { instrumentId } });
    expect(rows).toHaveLength(2);
  });
});

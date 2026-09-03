import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import { getInstrumentThesis } from "@/lib/thesis/get-instrument-thesis";

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

describe("getInstrumentThesis", () => {
  it("returns an empty string when no thesis exists yet", async () => {
    expect(await getInstrumentThesis(instrumentId, testDb.prisma)).toBe("");
  });

  it("returns the stored content when a thesis exists", async () => {
    await testDb.prisma.thesis.create({ data: { instrumentId, content: "Durable moat." } });

    expect(await getInstrumentThesis(instrumentId, testDb.prisma)).toBe("Durable moat.");
  });
});

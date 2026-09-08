import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import { upsertThesis } from "@/lib/thesis/upsert-thesis";

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

describe("upsertThesis", () => {
  it("creates a Thesis row with trimmed content", async () => {
    const thesis = await upsertThesis({ instrumentId, content: "  Durable moat, expanding margins.  " }, testDb.prisma);

    expect(thesis).toMatchObject({ instrumentId, content: "Durable moat, expanding margins." });
  });

  it("updates the existing row instead of creating a second one when submitted again", async () => {
    await upsertThesis({ instrumentId, content: "First draft." }, testDb.prisma);
    await upsertThesis({ instrumentId, content: "Revised thesis." }, testDb.prisma);

    const rows = await testDb.prisma.thesis.findMany({ where: { instrumentId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe("Revised thesis.");
  });

  it("allows clearing the thesis to an empty string", async () => {
    await upsertThesis({ instrumentId, content: "Something." }, testDb.prisma);
    const thesis = await upsertThesis({ instrumentId, content: "   " }, testDb.prisma);

    expect(thesis.content).toBe("");
  });
});

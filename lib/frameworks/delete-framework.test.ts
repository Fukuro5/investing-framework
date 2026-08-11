import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assignInstrument } from "@/lib/frameworks/assign-instrument";
import { createFramework } from "@/lib/frameworks/create-framework";
import { createGroup } from "@/lib/frameworks/create-group";
import { deleteFramework } from "@/lib/frameworks/delete-framework";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(async () => {
  await testDb.cleanup();
});

describe("deleteFramework", () => {
  it("cascades through groups and assignments, unlike deleting a single group", async () => {
    const framework = await createFramework({ name: "Quality", description: null }, testDb.prisma);
    const group = await createGroup(
      { frameworkId: framework.id, name: "Core", targetAllocationMin: 100, targetAllocationMax: 100, priority: 0 },
      testDb.prisma,
    );
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "TSM.US", name: "TSM", assetType: "unknown", currency: "USD" },
    });
    await assignInstrument({ frameworkId: framework.id, groupId: group.id, instrumentId: instrument.id }, testDb.prisma);

    await deleteFramework(framework.id, testDb.prisma);

    expect(await testDb.prisma.framework.findUnique({ where: { id: framework.id } })).toBeNull();
    expect(await testDb.prisma.frameworkGroup.count()).toBe(0);
    expect(await testDb.prisma.instrumentGroupAssignment.count()).toBe(0);
    // The instrument itself isn't framework-scoped data — it should survive.
    expect(await testDb.prisma.instrument.findUnique({ where: { id: instrument.id } })).not.toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assignInstrument } from "@/lib/frameworks/assign-instrument";
import { createFramework } from "@/lib/frameworks/create-framework";
import { createGroup } from "@/lib/frameworks/create-group";
import { deleteGroup, GroupHasAssignmentsError } from "@/lib/frameworks/delete-group";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

let testDb: TestDb;
let frameworkId: string;

beforeEach(async () => {
  testDb = createTestDb();
  const framework = await createFramework({ name: "Quality", description: null }, testDb.prisma);
  frameworkId = framework.id;
});

afterEach(async () => {
  await testDb.cleanup();
});

describe("deleteGroup", () => {
  it("deletes a group with no assignments", async () => {
    const group = await createGroup(
      { frameworkId, name: "Core", targetAllocationMin: 100, targetAllocationMax: 100, priority: 0 },
      testDb.prisma,
    );

    await deleteGroup(group.id, testDb.prisma);

    expect(await testDb.prisma.frameworkGroup.findUnique({ where: { id: group.id } })).toBeNull();
  });

  it("throws GroupHasAssignmentsError and leaves the group intact when instruments are assigned", async () => {
    const group = await createGroup(
      { frameworkId, name: "Core", targetAllocationMin: 100, targetAllocationMax: 100, priority: 0 },
      testDb.prisma,
    );
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "TSM.US", name: "TSM", assetType: "unknown", currency: "USD" },
    });
    await assignInstrument({ frameworkId, groupId: group.id, instrumentId: instrument.id }, testDb.prisma);

    await expect(deleteGroup(group.id, testDb.prisma)).rejects.toThrow(GroupHasAssignmentsError);
    expect(await testDb.prisma.frameworkGroup.findUnique({ where: { id: group.id } })).not.toBeNull();
  });
});

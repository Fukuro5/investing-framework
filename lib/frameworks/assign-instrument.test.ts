import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assignInstrument, unassignInstrument } from "@/lib/frameworks/assign-instrument";
import { createFramework } from "@/lib/frameworks/create-framework";
import { createGroup } from "@/lib/frameworks/create-group";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

let testDb: TestDb;
let frameworkId: string;
let coreGroupId: string;
let convexityGroupId: string;
let instrumentId: string;

beforeEach(async () => {
  testDb = createTestDb();
  const framework = await createFramework({ name: "Quality", description: null }, testDb.prisma);
  frameworkId = framework.id;
  coreGroupId = (await createGroup({ frameworkId, name: "Core", targetAllocationMin: 50, targetAllocationMax: 60, priority: 0 }, testDb.prisma)).id;
  convexityGroupId = (await createGroup({ frameworkId, name: "Convexity", targetAllocationMin: 10, targetAllocationMax: 20, priority: 1 }, testDb.prisma)).id;
  instrumentId = (await testDb.prisma.instrument.create({ data: { ticker: "TSM.US", name: "TSM", assetType: "unknown", currency: "USD" } })).id;
});

afterEach(async () => {
  await testDb.cleanup();
});

describe("assignInstrument", () => {
  it("creates a manual assignment", async () => {
    await assignInstrument({ frameworkId, groupId: coreGroupId, instrumentId }, testDb.prisma);

    const assignment = await testDb.prisma.instrumentGroupAssignment.findUniqueOrThrow({
      where: { frameworkId_instrumentId: { frameworkId, instrumentId } },
    });
    expect(assignment).toMatchObject({ groupId: coreGroupId, source: "manual" });
  });

  it("moves an existing assignment to a different group instead of creating a duplicate row", async () => {
    await assignInstrument({ frameworkId, groupId: coreGroupId, instrumentId }, testDb.prisma);
    await assignInstrument({ frameworkId, groupId: convexityGroupId, instrumentId }, testDb.prisma);

    const assignments = await testDb.prisma.instrumentGroupAssignment.findMany({ where: { frameworkId, instrumentId } });
    expect(assignments).toHaveLength(1);
    expect(assignments[0].groupId).toBe(convexityGroupId);
  });
});

describe("unassignInstrument", () => {
  it("removes the assignment, leaving the instrument unclassified for this framework", async () => {
    await assignInstrument({ frameworkId, groupId: coreGroupId, instrumentId }, testDb.prisma);

    await unassignInstrument(frameworkId, instrumentId, testDb.prisma);

    expect(await testDb.prisma.instrumentGroupAssignment.findMany({ where: { frameworkId, instrumentId } })).toEqual([]);
  });

  it("is a no-op (doesn't throw) when there's no existing assignment", async () => {
    await expect(unassignInstrument(frameworkId, instrumentId, testDb.prisma)).resolves.not.toThrow();
  });
});

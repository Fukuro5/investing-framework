import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFramework } from "@/lib/frameworks/create-framework";
import { createGroup } from "@/lib/frameworks/create-group";
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

describe("createGroup", () => {
  it("creates a group with a trimmed name", async () => {
    const group = await createGroup(
      { frameworkId, name: " Core ", targetAllocationMin: 65, targetAllocationMax: 75, priority: 0 },
      testDb.prisma,
    );

    expect(group).toMatchObject({ name: "Core", priority: 0 });

    const groupRule = await testDb.prisma.groupRule.findFirstOrThrow({ where: { groupId: group.id } });
    expect(groupRule).toMatchObject({
      type: "allocation",
      scope: "group",
      minAllocation: 65,
      maxAllocation: 75,
      role: "signal",
    });
  });

  it("throws when min is greater than max", async () => {
    await expect(
      createGroup({ frameworkId, name: "Core", targetAllocationMin: 80, targetAllocationMax: 70, priority: 0 }, testDb.prisma),
    ).rejects.toThrow(/minimum can't be greater than the maximum/);
  });

  it("throws when the band falls outside 0-100", async () => {
    await expect(
      createGroup({ frameworkId, name: "Core", targetAllocationMin: -5, targetAllocationMax: 70, priority: 0 }, testDb.prisma),
    ).rejects.toThrow(/between 0 and 100/);
  });

  it("throws for a duplicate group name within the same framework", async () => {
    await createGroup({ frameworkId, name: "Core", targetAllocationMin: 50, targetAllocationMax: 60, priority: 0 }, testDb.prisma);

    await expect(
      createGroup({ frameworkId, name: "Core", targetAllocationMin: 10, targetAllocationMax: 20, priority: 1 }, testDb.prisma),
    ).rejects.toThrow(/already has a group named "Core"/);
  });
});

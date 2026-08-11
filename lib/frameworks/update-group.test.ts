import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFramework } from "@/lib/frameworks/create-framework";
import { createGroup } from "@/lib/frameworks/create-group";
import { updateGroup } from "@/lib/frameworks/update-group";
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

describe("updateGroup", () => {
  it("updates the band and priority", async () => {
    const group = await createGroup(
      { frameworkId, name: "Core", targetAllocationMin: 65, targetAllocationMax: 75, priority: 0 },
      testDb.prisma,
    );

    const updated = await updateGroup(
      { groupId: group.id, name: "Core", targetAllocationMin: 60, targetAllocationMax: 80, priority: 1 },
      testDb.prisma,
    );

    expect(updated).toMatchObject({ targetAllocationMin: 60, targetAllocationMax: 80, priority: 1 });
  });

  it("allows renaming to a name not used by another group in the same framework", async () => {
    const group = await createGroup(
      { frameworkId, name: "Core", targetAllocationMin: 100, targetAllocationMax: 100, priority: 0 },
      testDb.prisma,
    );

    const updated = await updateGroup(
      { groupId: group.id, name: "Core Holdings", targetAllocationMin: 100, targetAllocationMax: 100, priority: 0 },
      testDb.prisma,
    );

    expect(updated.name).toBe("Core Holdings");
  });

  it("throws when renaming to a name already used by a different group in the same framework", async () => {
    await createGroup({ frameworkId, name: "Core", targetAllocationMin: 50, targetAllocationMax: 60, priority: 0 }, testDb.prisma);
    const convexity = await createGroup(
      { frameworkId, name: "Convexity", targetAllocationMin: 10, targetAllocationMax: 20, priority: 1 },
      testDb.prisma,
    );

    await expect(
      updateGroup({ groupId: convexity.id, name: "Core", targetAllocationMin: 10, targetAllocationMax: 20, priority: 1 }, testDb.prisma),
    ).rejects.toThrow(/already has a group named "Core"/);
  });
});

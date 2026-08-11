import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFramework } from "@/lib/frameworks/create-framework";
import { createGroup } from "@/lib/frameworks/create-group";
import { GroupsNotFullyAllocatedError, setActiveFramework } from "@/lib/frameworks/set-active-framework";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(async () => {
  await testDb.cleanup();
});

describe("setActiveFramework", () => {
  it("activates a framework whose groups bracket 100%, deactivating any previously active one", async () => {
    const quality = await createFramework({ name: "Quality", description: null }, testDb.prisma);
    await createGroup({ frameworkId: quality.id, name: "Core", targetAllocationMin: 100, targetAllocationMax: 100, priority: 0 }, testDb.prisma);
    await setActiveFramework(quality.id, testDb.prisma);

    const momentum = await createFramework({ name: "Momentum", description: null }, testDb.prisma);
    await createGroup({ frameworkId: momentum.id, name: "Trend", targetAllocationMin: 100, targetAllocationMax: 100, priority: 0 }, testDb.prisma);
    await setActiveFramework(momentum.id, testDb.prisma);

    expect(await testDb.prisma.framework.findUniqueOrThrow({ where: { id: quality.id } })).toMatchObject({ isActive: false });
    expect(await testDb.prisma.framework.findUniqueOrThrow({ where: { id: momentum.id } })).toMatchObject({ isActive: true });
  });

  it("throws GroupsNotFullyAllocatedError and doesn't activate when bands don't bracket 100%", async () => {
    const framework = await createFramework({ name: "Quality", description: null }, testDb.prisma);
    await createGroup({ frameworkId: framework.id, name: "Core", targetAllocationMin: 10, targetAllocationMax: 50, priority: 0 }, testDb.prisma);

    await expect(setActiveFramework(framework.id, testDb.prisma)).rejects.toThrow(GroupsNotFullyAllocatedError);
    expect(await testDb.prisma.framework.findUniqueOrThrow({ where: { id: framework.id } })).toMatchObject({ isActive: false });
  });
});

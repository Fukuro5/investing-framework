import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFramework } from "@/lib/frameworks/create-framework";
import { createGroup } from "@/lib/frameworks/create-group";
import { listFrameworks } from "@/lib/frameworks/list-frameworks";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(async () => {
  await testDb.cleanup();
});

describe("listFrameworks", () => {
  it("returns frameworks ordered by name with their group count", async () => {
    const momentum = await createFramework({ name: "Momentum", description: null }, testDb.prisma);
    const quality = await createFramework({ name: "Quality", description: null }, testDb.prisma);
    await createGroup({ frameworkId: quality.id, name: "Core", targetAllocationMin: 100, targetAllocationMax: 100, priority: 0 }, testDb.prisma);

    const frameworks = await listFrameworks(testDb.prisma);

    expect(frameworks.map((framework) => framework.name)).toEqual(["Momentum", "Quality"]);
    expect(frameworks.find((framework) => framework.id === momentum.id)?._count.groups).toBe(0);
    expect(frameworks.find((framework) => framework.id === quality.id)?._count.groups).toBe(1);
  });
});

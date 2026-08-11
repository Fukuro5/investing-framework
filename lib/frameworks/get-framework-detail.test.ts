import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assignInstrument } from "@/lib/frameworks/assign-instrument";
import { createFramework } from "@/lib/frameworks/create-framework";
import { createGroup } from "@/lib/frameworks/create-group";
import { getFrameworkDetail } from "@/lib/frameworks/get-framework-detail";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(async () => {
  await testDb.cleanup();
});

describe("getFrameworkDetail", () => {
  it("returns the framework, its groups ordered by priority, assignments with instrument data, and the groups total", async () => {
    const framework = await createFramework({ name: "Quality", description: null }, testDb.prisma);
    await createGroup({ frameworkId: framework.id, name: "Convexity", targetAllocationMin: 15, targetAllocationMax: 25, priority: 1 }, testDb.prisma);
    const core = await createGroup({ frameworkId: framework.id, name: "Core", targetAllocationMin: 65, targetAllocationMax: 75, priority: 0 }, testDb.prisma);
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "TSM.US", name: "Taiwan Semiconductor", assetType: "unknown", currency: "USD" },
    });
    await assignInstrument({ frameworkId: framework.id, groupId: core.id, instrumentId: instrument.id }, testDb.prisma);

    const detail = await getFrameworkDetail(framework.id, testDb.prisma);

    expect(detail.framework.groups.map((group) => group.name)).toEqual(["Core", "Convexity"]);
    expect(detail.assignments).toHaveLength(1);
    expect(detail.assignments[0].instrument.ticker).toBe("TSM.US");
    expect(detail.groupsTotal.isValid).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { revertAssignmentToAuto } from "@/lib/frameworks/revert-assignment-to-auto";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

let testDb: TestDb;
let frameworkId: string;
let instrumentId: string;

beforeEach(async () => {
  testDb = createTestDb();
  const framework = await testDb.prisma.framework.create({ data: { name: "Quality" } });
  frameworkId = framework.id;
  instrumentId = (await testDb.prisma.instrument.create({ data: { ticker: "TSM.US", name: "TSM", assetType: "unknown", currency: "USD" } })).id;
});

afterEach(async () => {
  await testDb.cleanup();
});

const seedGroupWithRule = (name: string, priority: number, threshold: number) =>
  testDb.prisma.frameworkGroup.create({
    data: {
      frameworkId,
      name,
      priority,
      rules: { create: { type: "metric", metricKey: "roic", operator: "gt", threshold, isActive: true } },
    },
  });

describe("revertAssignmentToAuto", () => {
  it("deletes the manual assignment and re-classifies into a matching group", async () => {
    const core = await seedGroupWithRule("Core", 0, 15);
    const convexity = await testDb.prisma.frameworkGroup.create({ data: { frameworkId, name: "Convexity", priority: 1 } });
    await testDb.prisma.instrumentGroupAssignment.create({
      data: { frameworkId, groupId: convexity.id, instrumentId, source: "manual" },
    });
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "roic", value: 20, asOfDate: new Date("2026-07-31"), source: "api" },
    });

    const result = await revertAssignmentToAuto(frameworkId, instrumentId, testDb.prisma);

    expect(result).toEqual({ groupId: core.id });
    const assignment = await testDb.prisma.instrumentGroupAssignment.findUniqueOrThrow({
      where: { frameworkId_instrumentId: { frameworkId, instrumentId } },
    });
    expect(assignment).toMatchObject({ groupId: core.id, source: "auto" });
  });

  it("leaves the instrument unclassified when no group matches after reverting", async () => {
    await seedGroupWithRule("Core", 0, 15);
    await testDb.prisma.instrumentGroupAssignment.create({
      data: { frameworkId, groupId: (await testDb.prisma.frameworkGroup.findFirstOrThrow()).id, instrumentId, source: "manual" },
    });
    await testDb.prisma.metricValue.create({
      data: { instrumentId, metricKey: "roic", value: 5, asOfDate: new Date("2026-07-31"), source: "api" },
    });

    const result = await revertAssignmentToAuto(frameworkId, instrumentId, testDb.prisma);

    expect(result).toEqual({ groupId: null });
    expect(await testDb.prisma.instrumentGroupAssignment.findMany({ where: { frameworkId, instrumentId } })).toEqual([]);
  });

  it("is a no-op when there's no manual assignment to revert", async () => {
    await seedGroupWithRule("Core", 0, 15);

    const result = await revertAssignmentToAuto(frameworkId, instrumentId, testDb.prisma);

    expect(result).toEqual({ groupId: null });
    expect(await testDb.prisma.instrumentGroupAssignment.findMany({ where: { frameworkId, instrumentId } })).toEqual([]);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRule } from "@/lib/frameworks/create-rule";
import { deleteRule } from "@/lib/frameworks/delete-rule";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(async () => {
  await testDb.cleanup();
});

describe("deleteRule", () => {
  it("deletes the rule", async () => {
    const framework = await testDb.prisma.framework.create({ data: { name: "Quality" } });
    const group = await testDb.prisma.frameworkGroup.create({
      data: { frameworkId: framework.id, name: "Core", targetAllocationMin: 100, targetAllocationMax: 100, priority: 0 },
    });
    const rule = await createRule({ groupId: group.id, metricKey: "roic", operator: "gt", threshold: 15 }, testDb.prisma);

    await deleteRule(rule.id, testDb.prisma);

    expect(await testDb.prisma.groupRule.findUnique({ where: { id: rule.id } })).toBeNull();
  });
});

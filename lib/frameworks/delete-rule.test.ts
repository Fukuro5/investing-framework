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
  it("deletes a metric rule", async () => {
    const framework = await testDb.prisma.framework.create({ data: { name: "Quality" } });
    const group = await testDb.prisma.frameworkGroup.create({
      data: { frameworkId: framework.id, name: "Core", priority: 0 },
    });
    const rule = await createRule(
      { groupId: group.id, type: "metric", metricKey: "roic", operator: "gt", threshold: 15, role: "classification" },
      testDb.prisma,
    );

    await deleteRule(rule.id, testDb.prisma);

    expect(await testDb.prisma.groupRule.findUnique({ where: { id: rule.id } })).toBeNull();
  });

  it("throws when trying to delete a group's own scope='group' allocation rule", async () => {
    const framework = await testDb.prisma.framework.create({ data: { name: "Quality" } });
    const group = await testDb.prisma.frameworkGroup.create({
      data: { frameworkId: framework.id, name: "Core", priority: 0 },
    });
    const groupScopeRule = await testDb.prisma.groupRule.create({
      data: { groupId: group.id, type: "allocation", scope: "group", minAllocation: 100, maxAllocation: 100, role: "signal" },
    });

    await expect(deleteRule(groupScopeRule.id, testDb.prisma)).rejects.toThrow(/can't be deleted/);
    expect(await testDb.prisma.groupRule.findUnique({ where: { id: groupScopeRule.id } })).not.toBeNull();
  });
});

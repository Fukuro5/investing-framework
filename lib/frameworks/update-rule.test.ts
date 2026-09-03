import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRule } from "@/lib/frameworks/create-rule";
import { updateRule } from "@/lib/frameworks/update-rule";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

let testDb: TestDb;
let groupId: string;

beforeEach(async () => {
  testDb = createTestDb();
  const framework = await testDb.prisma.framework.create({ data: { name: "Quality" } });
  const group = await testDb.prisma.frameworkGroup.create({
    data: { frameworkId: framework.id, name: "Core", priority: 0 },
  });
  groupId = group.id;
  await testDb.prisma.groupRule.create({
    data: { groupId, type: "allocation", scope: "group", minAllocation: 100, maxAllocation: 100, role: "signal" },
  });
});

afterEach(async () => {
  await testDb.cleanup();
});

describe("updateRule", () => {
  it("updates a metric rule's threshold, role, and active flag", async () => {
    const rule = await createRule(
      { groupId, type: "metric", metricKey: "roic", operator: "gt", threshold: 15, role: "classification" },
      testDb.prisma,
    );

    const updated = await updateRule(
      { ruleId: rule.id, type: "metric", metricKey: "roic", operator: "gt", threshold: 20, role: "signal", isActive: false },
      testDb.prisma,
    );

    expect(updated).toMatchObject({ threshold: 20, role: "signal", isActive: false });
  });

  it("throws for an invalid operator", async () => {
    const rule = await createRule(
      { groupId, type: "metric", metricKey: "roic", operator: "gt", threshold: 15, role: "classification" },
      testDb.prisma,
    );

    await expect(
      updateRule(
        { ruleId: rule.id, type: "metric", metricKey: "roic", operator: "between", threshold: 15, role: "classification", isActive: true },
        testDb.prisma,
      ),
    ).rejects.toThrow(/Unrecognized operator/);
  });

  it("throws for an invalid role", async () => {
    const rule = await createRule(
      { groupId, type: "metric", metricKey: "roic", operator: "gt", threshold: 15, role: "classification" },
      testDb.prisma,
    );

    await expect(
      updateRule(
        { ruleId: rule.id, type: "metric", metricKey: "roic", operator: "gt", threshold: 15, role: "unknown", isActive: true },
        testDb.prisma,
      ),
    ).rejects.toThrow(/Unrecognized role/);
  });

  it("updates a position-scoped allocation rule's band", async () => {
    const rule = await createRule({ groupId, type: "allocation", minAllocation: 0, maxAllocation: 15 }, testDb.prisma);

    const updated = await updateRule(
      { ruleId: rule.id, type: "allocation", minAllocation: 0, maxAllocation: 20, isActive: true },
      testDb.prisma,
    );

    expect(updated).toMatchObject({ minAllocation: 0, maxAllocation: 20 });
  });

  it("throws when trying to edit the group's own scope='group' rule through this action", async () => {
    const groupScopeRule = await testDb.prisma.groupRule.findFirstOrThrow({ where: { groupId } });

    await expect(
      updateRule(
        { ruleId: groupScopeRule.id, type: "allocation", minAllocation: 0, maxAllocation: 50, isActive: true },
        testDb.prisma,
      ),
    ).rejects.toThrow(/edited from the group form/);
  });
});

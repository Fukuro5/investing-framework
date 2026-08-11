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
    data: { frameworkId: framework.id, name: "Core", targetAllocationMin: 100, targetAllocationMax: 100, priority: 0 },
  });
  groupId = group.id;
});

afterEach(async () => {
  await testDb.cleanup();
});

describe("updateRule", () => {
  it("updates the threshold and active flag", async () => {
    const rule = await createRule({ groupId, metricKey: "roic", operator: "gt", threshold: 15 }, testDb.prisma);

    const updated = await updateRule(
      { ruleId: rule.id, metricKey: "roic", operator: "gt", threshold: 20, isActive: false },
      testDb.prisma,
    );

    expect(updated).toMatchObject({ threshold: 20, isActive: false });
  });

  it("throws for an invalid operator", async () => {
    const rule = await createRule({ groupId, metricKey: "roic", operator: "gt", threshold: 15 }, testDb.prisma);

    await expect(
      updateRule({ ruleId: rule.id, metricKey: "roic", operator: "between", threshold: 15, isActive: true }, testDb.prisma),
    ).rejects.toThrow(/Unrecognized operator/);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRule } from "@/lib/frameworks/create-rule";
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

describe("createRule", () => {
  it("creates a classification rule with a trimmed metric key", async () => {
    const rule = await createRule({ groupId, metricKey: " roic ", operator: "gt", threshold: 15 }, testDb.prisma);

    expect(rule).toMatchObject({ metricKey: "roic", operator: "gt", threshold: 15, role: "classification", isActive: true });
  });

  it("throws for a blank metric key", async () => {
    await expect(createRule({ groupId, metricKey: "  ", operator: "gt", threshold: 15 }, testDb.prisma)).rejects.toThrow(
      /Metric key is required/,
    );
  });

  it("throws for an invalid operator", async () => {
    await expect(
      createRule({ groupId, metricKey: "roic", operator: "between", threshold: 15 }, testDb.prisma),
    ).rejects.toThrow(/Unrecognized operator/);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRule } from "@/lib/frameworks/create-rule";
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
    data: { groupId, type: "allocation", scope: "group", minAllocation: 100, maxAllocation: 100 },
  });
});

afterEach(async () => {
  await testDb.cleanup();
});

describe("createRule", () => {
  it("creates a metric rule with a trimmed metric key", async () => {
    const rule = await createRule({ groupId, type: "metric", metricKey: " roic ", operator: "gt", threshold: 15 }, testDb.prisma);

    expect(rule).toMatchObject({
      type: "metric",
      metricKey: "roic",
      operator: "gt",
      threshold: 15,
      isActive: true,
    });
  });

  it("throws for a blank metric key", async () => {
    await expect(
      createRule({ groupId, type: "metric", metricKey: "  ", operator: "gt", threshold: 15 }, testDb.prisma),
    ).rejects.toThrow(/Metric key is required/);
  });

  it("throws for a metric key not in the catalog", async () => {
    await expect(
      createRule({ groupId, type: "metric", metricKey: "notARealMetric", operator: "gt", threshold: 15 }, testDb.prisma),
    ).rejects.toThrow(/Unrecognized metric key/);
  });

  it("throws for an invalid operator", async () => {
    await expect(
      createRule({ groupId, type: "metric", metricKey: "roic", operator: "between", threshold: 15 }, testDb.prisma),
    ).rejects.toThrow(/Unrecognized operator/);
  });

  it("creates a position-scoped allocation rule", async () => {
    const rule = await createRule({ groupId, type: "allocation", minAllocation: 0, maxAllocation: 15 }, testDb.prisma);

    expect(rule).toMatchObject({ type: "allocation", scope: "position", minAllocation: 0, maxAllocation: 15 });
  });

  it("throws when the allocation band is outside 0-100", async () => {
    await expect(
      createRule({ groupId, type: "allocation", minAllocation: -5, maxAllocation: 15 }, testDb.prisma),
    ).rejects.toThrow(/between 0 and 100/);
  });

  it("throws when the allocation minimum is greater than the maximum", async () => {
    await expect(
      createRule({ groupId, type: "allocation", minAllocation: 20, maxAllocation: 10 }, testDb.prisma),
    ).rejects.toThrow(/minimum can't be greater than the maximum/);
  });

  it("throws when the group already has a position-scoped allocation rule", async () => {
    await createRule({ groupId, type: "allocation", minAllocation: 0, maxAllocation: 15 }, testDb.prisma);

    await expect(
      createRule({ groupId, type: "allocation", minAllocation: 0, maxAllocation: 20 }, testDb.prisma),
    ).rejects.toThrow(/already has a position-level allocation rule/);
  });
});

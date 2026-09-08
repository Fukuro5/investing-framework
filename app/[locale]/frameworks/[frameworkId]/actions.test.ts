import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assignInstrumentAction,
  createGroupAction,
  createRuleAction,
  deleteGroupAction,
  deleteRuleAction,
  evaluateFrameworkAction,
  updateFrameworkAction,
  updateGroupAction,
  updateRuleAction,
  type EvaluateFrameworkState,
  type FormState,
} from "@/app/[locale]/frameworks/[frameworkId]/actions";
import type { DeleteActionState } from "@/components/DeleteButton";
import { UNCLASSIFIED_ASSIGNMENT_VALUE } from "@/lib/frameworks/consts";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

// See app/[locale]/frameworks/actions.test.ts for why this is mocked.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string, params?: Record<string, unknown>) =>
    params ? `${namespace}.${key}:${JSON.stringify(params)}` : `${namespace}.${key}`,
}));

let testDb: TestDb;
let frameworkId: string;

beforeEach(async () => {
  testDb = createTestDb();
  const framework = await testDb.prisma.framework.create({ data: { name: "Quality" } });
  frameworkId = framework.id;
});

afterEach(async () => {
  await testDb.cleanup();
});

const buildFormData = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
};

// Every group requires its own type='allocation', scope='group' rule
// (PLANNING.md §1 Phase 1) — seeded alongside the group here so tests that
// don't go through createGroupAction still start from a realistic shape.
const seedGroup = async (overrides: { name?: string; minAllocation?: number; maxAllocation?: number; priority?: number } = {}) => {
  const group = await testDb.prisma.frameworkGroup.create({
    data: { frameworkId, name: overrides.name ?? "Core", priority: overrides.priority ?? 0 },
  });
  await testDb.prisma.groupRule.create({
    data: {
      groupId: group.id,
      type: "allocation",
      scope: "group",
      minAllocation: overrides.minAllocation ?? 100,
      maxAllocation: overrides.maxAllocation ?? 100,
      role: "signal",
    },
  });
  return group;
};

describe("updateFrameworkAction", () => {
  it("updates the name and description", async () => {
    const state = await updateFrameworkAction(
      { status: "idle" } as FormState,
      buildFormData({ frameworkId, name: "Quality v2", description: "Renamed" }),
      testDb.prisma,
    );

    expect(state).toEqual({ status: "idle" });
    expect(await testDb.prisma.framework.findUniqueOrThrow({ where: { id: frameworkId } })).toMatchObject({
      name: "Quality v2",
      description: "Renamed",
    });
  });
});

describe("createGroupAction", () => {
  it("creates a group and its required allocation band from form fields", async () => {
    const state = await createGroupAction(
      { status: "idle" } as FormState,
      buildFormData({ frameworkId, name: "Core", targetAllocationMin: "65", targetAllocationMax: "75", priority: "0" }),
      testDb.prisma,
    );

    expect(state).toEqual({ status: "idle" });
    const group = await testDb.prisma.frameworkGroup.findFirstOrThrow();
    expect(group).toMatchObject({ name: "Core", priority: 0 });
    const groupRule = await testDb.prisma.groupRule.findFirstOrThrow({ where: { groupId: group.id } });
    expect(groupRule).toMatchObject({ type: "allocation", scope: "group", minAllocation: 65, maxAllocation: 75 });
  });

  it("returns a translated error for a non-numeric field instead of throwing", async () => {
    const state = await createGroupAction(
      { status: "idle" } as FormState,
      buildFormData({ frameworkId, name: "Core", targetAllocationMin: "not-a-number", targetAllocationMax: "75", priority: "0" }),
      testDb.prisma,
    );

    expect(state.status).toBe("error");
    expect(state.errorMessage).toContain("groupFieldMustBeNumber");
    expect(await testDb.prisma.frameworkGroup.count()).toBe(0);
  });
});

describe("updateGroupAction", () => {
  it("updates the group's priority and its allocation band", async () => {
    const group = await seedGroup({ minAllocation: 65, maxAllocation: 75 });

    const state = await updateGroupAction(
      { status: "idle" } as FormState,
      buildFormData({ groupId: group.id, name: "Core", targetAllocationMin: "60", targetAllocationMax: "80", priority: "1" }),
      testDb.prisma,
    );

    expect(state).toEqual({ status: "idle" });
    expect(await testDb.prisma.frameworkGroup.findUniqueOrThrow({ where: { id: group.id } })).toMatchObject({ priority: 1 });
    const groupRule = await testDb.prisma.groupRule.findFirstOrThrow({ where: { groupId: group.id } });
    expect(groupRule).toMatchObject({ minAllocation: 60, maxAllocation: 80 });
  });
});

describe("deleteGroupAction", () => {
  it("returns a translated error and keeps the group when it has assignments", async () => {
    const group = await seedGroup();
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "TSM.US", name: "TSM", assetType: "unknown", currency: "USD" },
    });
    await testDb.prisma.instrumentGroupAssignment.create({
      data: { frameworkId, groupId: group.id, instrumentId: instrument.id, source: "manual" },
    });

    const state = await deleteGroupAction(
      { status: "idle" } as DeleteActionState,
      buildFormData({ groupId: group.id }),
      testDb.prisma,
    );

    expect(state.status).toBe("error");
    expect(state.errorMessage).toContain("groupHasAssignments");
    expect(await testDb.prisma.frameworkGroup.findUnique({ where: { id: group.id } })).not.toBeNull();
  });
});

describe("assignInstrumentAction", () => {
  it("assigns the instrument to the selected group", async () => {
    const group = await seedGroup();
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "TSM.US", name: "TSM", assetType: "unknown", currency: "USD" },
    });

    await assignInstrumentAction(buildFormData({ frameworkId, instrumentId: instrument.id, groupId: group.id }), testDb.prisma);

    const assignment = await testDb.prisma.instrumentGroupAssignment.findUniqueOrThrow({
      where: { frameworkId_instrumentId: { frameworkId, instrumentId: instrument.id } },
    });
    expect(assignment.groupId).toBe(group.id);
  });

  it("removes the assignment when the sentinel unclassified value is selected", async () => {
    const group = await seedGroup();
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "TSM.US", name: "TSM", assetType: "unknown", currency: "USD" },
    });
    await testDb.prisma.instrumentGroupAssignment.create({
      data: { frameworkId, groupId: group.id, instrumentId: instrument.id, source: "manual" },
    });

    await assignInstrumentAction(
      buildFormData({ frameworkId, instrumentId: instrument.id, groupId: UNCLASSIFIED_ASSIGNMENT_VALUE }),
      testDb.prisma,
    );

    expect(
      await testDb.prisma.instrumentGroupAssignment.findMany({ where: { frameworkId, instrumentId: instrument.id } }),
    ).toEqual([]);
  });
});

describe("createRuleAction", () => {
  it("creates a metric rule from form fields", async () => {
    const group = await seedGroup();

    const state = await createRuleAction(
      { status: "idle" } as FormState,
      buildFormData({ groupId: group.id, type: "metric", metricKey: "roic", operator: "gt", threshold: "15", role: "classification" }),
      testDb.prisma,
    );

    expect(state).toEqual({ status: "idle" });
    const rule = await testDb.prisma.groupRule.findFirstOrThrow({ where: { type: "metric" } });
    expect(rule).toMatchObject({ metricKey: "roic", operator: "gt", threshold: 15, role: "classification" });
  });

  it("returns a translated error for an invalid operator instead of throwing", async () => {
    const group = await seedGroup();

    const state = await createRuleAction(
      { status: "idle" } as FormState,
      buildFormData({ groupId: group.id, type: "metric", metricKey: "roic", operator: "between", threshold: "15", role: "classification" }),
      testDb.prisma,
    );

    expect(state.status).toBe("error");
    expect(state.errorMessage).toContain("ruleOperatorInvalid");
  });

  it("creates a position-scoped allocation rule from form fields", async () => {
    const group = await seedGroup();

    const state = await createRuleAction(
      { status: "idle" } as FormState,
      buildFormData({ groupId: group.id, type: "allocation", minAllocation: "0", maxAllocation: "15" }),
      testDb.prisma,
    );

    expect(state).toEqual({ status: "idle" });
    const rule = await testDb.prisma.groupRule.findFirstOrThrow({ where: { scope: "position" } });
    expect(rule).toMatchObject({ type: "allocation", scope: "position", minAllocation: 0, maxAllocation: 15, role: "signal" });
  });
});

describe("updateRuleAction", () => {
  it("updates a metric rule's threshold, role, and active flag", async () => {
    const group = await seedGroup();
    const rule = await testDb.prisma.groupRule.create({
      data: { groupId: group.id, type: "metric", metricKey: "roic", operator: "gt", threshold: 15, role: "classification", isActive: true },
    });

    const state = await updateRuleAction(
      { status: "idle" } as FormState,
      buildFormData({ ruleId: rule.id, type: "metric", metricKey: "roic", operator: "gt", threshold: "20", role: "signal" }),
      testDb.prisma,
    );

    expect(state).toEqual({ status: "idle" });
    expect(await testDb.prisma.groupRule.findUniqueOrThrow({ where: { id: rule.id } })).toMatchObject({
      threshold: 20,
      role: "signal",
      isActive: false,
    });
  });

  it("updates a position-scoped allocation rule's band", async () => {
    const group = await seedGroup();
    const rule = await testDb.prisma.groupRule.create({
      data: { groupId: group.id, type: "allocation", scope: "position", minAllocation: 0, maxAllocation: 10, role: "signal" },
    });

    const state = await updateRuleAction(
      { status: "idle" } as FormState,
      buildFormData({ ruleId: rule.id, type: "allocation", minAllocation: "0", maxAllocation: "20" }),
      testDb.prisma,
    );

    expect(state).toEqual({ status: "idle" });
    expect(await testDb.prisma.groupRule.findUniqueOrThrow({ where: { id: rule.id } })).toMatchObject({
      minAllocation: 0,
      maxAllocation: 20,
    });
  });
});

describe("deleteRuleAction", () => {
  it("deletes the rule", async () => {
    const group = await seedGroup();
    const rule = await testDb.prisma.groupRule.create({
      data: { groupId: group.id, type: "metric", metricKey: "roic", operator: "gt", threshold: 15, role: "classification", isActive: true },
    });

    const state = await deleteRuleAction({ status: "idle" } as DeleteActionState, buildFormData({ ruleId: rule.id }), testDb.prisma);

    expect(state).toEqual({ status: "idle" });
    expect(await testDb.prisma.groupRule.findUnique({ where: { id: rule.id } })).toBeNull();
  });

  it("returns a translated error and keeps the rule when trying to delete a group's own allocation band", async () => {
    const group = await seedGroup();
    const groupRule = await testDb.prisma.groupRule.findFirstOrThrow({ where: { groupId: group.id } });

    const state = await deleteRuleAction(
      { status: "idle" } as DeleteActionState,
      buildFormData({ ruleId: groupRule.id }),
      testDb.prisma,
    );

    expect(state.status).toBe("error");
    expect(state.errorMessage).toContain("ruleGroupScopeCannotBeDeleted");
    expect(await testDb.prisma.groupRule.findUnique({ where: { id: groupRule.id } })).not.toBeNull();
  });
});

describe("evaluateFrameworkAction", () => {
  it("classifies positions, returning the count", async () => {
    const group = await seedGroup();
    await testDb.prisma.groupRule.create({
      data: { groupId: group.id, type: "metric", metricKey: "roic", operator: "gt", threshold: 15, role: "classification", isActive: true },
    });
    const broker = await testDb.prisma.broker.create({ data: { name: "freedom-finance" } });
    const account = await testDb.prisma.account.create({
      data: { brokerId: broker.id, label: "Freedom Finance 000", baseCurrency: "USD" },
    });
    const importBatch = await testDb.prisma.importBatch.create({
      data: { accountId: account.id, fileName: "s.json", fileType: "application/json", status: "completed" },
    });
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "TSM.US", name: "TSM", assetType: "unknown", currency: "USD" },
    });
    await testDb.prisma.positionSnapshot.create({
      data: {
        accountId: account.id,
        instrumentId: instrument.id,
        importBatchId: importBatch.id,
        asOfDate: new Date("2026-07-31"),
        quantity: 1,
        avgCostPrice: 100,
        marketPrice: 0,
        marketValue: 0,
        unrealizedPnl: 0,
        currency: "USD",
      },
    });
    await testDb.prisma.metricValue.create({
      data: { instrumentId: instrument.id, metricKey: "roic", value: 20, asOfDate: new Date("2026-07-31"), source: "manual" },
    });

    const state = await evaluateFrameworkAction(
      { status: "idle" } as EvaluateFrameworkState,
      buildFormData({ frameworkId }),
      testDb.prisma,
    );

    expect(state).toEqual({ status: "success", classifiedCount: 1 });
  });
});

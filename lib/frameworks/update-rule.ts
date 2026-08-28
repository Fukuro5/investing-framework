import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isRuleOperator, isRuleRole } from "@/lib/frameworks/consts";
import { FrameworkError } from "@/lib/frameworks/errors";

export interface UpdateMetricRuleInput {
  ruleId: string;
  type: "metric";
  metricKey: string;
  operator: string;
  threshold: number;
  role: string;
  isActive: boolean;
}

export interface UpdateAllocationRuleInput {
  ruleId: string;
  type: "allocation";
  minAllocation: number;
  maxAllocation: number;
  isActive: boolean;
}

export type UpdateRuleInput = UpdateMetricRuleInput | UpdateAllocationRuleInput;

// A group's own type='allocation', scope='group' rule is only ever edited
// via update-group.ts, alongside the group itself — not reachable through
// this generic action.
const ensureNotGroupScope = async (ruleId: string, db: PrismaClient) => {
  const current = await db.groupRule.findUniqueOrThrow({ where: { id: ruleId } });

  if (current.type === "allocation" && current.scope === "group") {
    throw new FrameworkError(
      "ruleGroupScopeNotAllowed",
      "A group's own allocation band is edited from the group form, not the rule list",
    );
  }
};

const updateAllocationRule = async (input: UpdateAllocationRuleInput, db: PrismaClient) => {
  await ensureNotGroupScope(input.ruleId, db);

  if (input.minAllocation < 0 || input.maxAllocation > 100) {
    throw new FrameworkError("ruleAllocationOutOfRange", "Allocation must be between 0 and 100");
  }

  if (input.minAllocation > input.maxAllocation) {
    throw new FrameworkError("ruleMinGreaterThanMax", "Allocation minimum can't be greater than the maximum");
  }

  return db.groupRule.update({
    where: { id: input.ruleId },
    data: { minAllocation: input.minAllocation, maxAllocation: input.maxAllocation, isActive: input.isActive },
  });
};

const updateMetricRule = async (input: UpdateMetricRuleInput, db: PrismaClient) => {
  await ensureNotGroupScope(input.ruleId, db);
  const metricKey = input.metricKey.trim();

  if (metricKey.length === 0) {
    throw new FrameworkError("ruleMetricKeyRequired", "Metric key is required");
  }

  if (!isRuleOperator(input.operator)) {
    throw new FrameworkError("ruleOperatorInvalid", `Unrecognized operator "${input.operator}"`);
  }

  if (!isRuleRole(input.role)) {
    throw new FrameworkError("ruleRoleInvalid", `Unrecognized role "${input.role}"`);
  }

  return db.groupRule.update({
    where: { id: input.ruleId },
    data: {
      metricKey,
      operator: input.operator,
      threshold: input.threshold,
      role: input.role,
      isActive: input.isActive,
    },
  });
};

export const updateRule = (input: UpdateRuleInput, db: PrismaClient = prisma) =>
  input.type === "allocation" ? updateAllocationRule(input, db) : updateMetricRule(input, db);

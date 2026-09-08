import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isRuleOperator, isRuleRole } from "@/lib/frameworks/consts";
import { FrameworkError } from "@/lib/frameworks/errors";

export interface CreateMetricRuleInput {
  groupId: string;
  type: "metric";
  metricKey: string;
  operator: string;
  threshold: number;
  role: string;
}

// Always scope='position' via this path — the required scope='group' band
// is created alongside the group itself (see create-group.ts), not through
// this generic rule action.
export interface CreateAllocationRuleInput {
  groupId: string;
  type: "allocation";
  minAllocation: number;
  maxAllocation: number;
}

export type CreateRuleInput = CreateMetricRuleInput | CreateAllocationRuleInput;

const createAllocationRule = async (input: CreateAllocationRuleInput, db: PrismaClient) => {
  if (input.minAllocation < 0 || input.maxAllocation > 100) {
    throw new FrameworkError("ruleAllocationOutOfRange", "Allocation must be between 0 and 100");
  }

  if (input.minAllocation > input.maxAllocation) {
    throw new FrameworkError("ruleMinGreaterThanMax", "Allocation minimum can't be greater than the maximum");
  }

  const existingPositionRule = await db.groupRule.findFirst({
    where: { groupId: input.groupId, type: "allocation", scope: "position" },
  });
  if (existingPositionRule) {
    throw new FrameworkError(
      "rulePositionScopeAlreadyExists",
      "This group already has a position-level allocation rule — edit it instead of adding another",
    );
  }

  return db.groupRule.create({
    data: {
      groupId: input.groupId,
      type: "allocation",
      scope: "position",
      minAllocation: input.minAllocation,
      maxAllocation: input.maxAllocation,
      role: "signal",
    },
  });
};

const createMetricRule = async (input: CreateMetricRuleInput, db: PrismaClient) => {
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

  return db.groupRule.create({
    data: {
      groupId: input.groupId,
      type: "metric",
      metricKey,
      operator: input.operator,
      threshold: input.threshold,
      role: input.role,
    },
  });
};

export const createRule = (input: CreateRuleInput, db: PrismaClient = prisma) =>
  input.type === "allocation" ? createAllocationRule(input, db) : createMetricRule(input, db);

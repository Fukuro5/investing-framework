import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isRuleOperator } from "@/lib/frameworks/consts";
import { FrameworkError } from "@/lib/frameworks/errors";

export interface UpdateRuleInput {
  ruleId: string;
  metricKey: string;
  operator: string;
  threshold: number;
  isActive: boolean;
}

export const updateRule = async (input: UpdateRuleInput, db: PrismaClient = prisma) => {
  const metricKey = input.metricKey.trim();

  if (metricKey.length === 0) {
    throw new FrameworkError("ruleMetricKeyRequired", "Metric key is required");
  }

  if (!isRuleOperator(input.operator)) {
    throw new FrameworkError("ruleOperatorInvalid", `Unrecognized operator "${input.operator}"`);
  }

  return db.groupRule.update({
    where: { id: input.ruleId },
    data: {
      metricKey,
      operator: input.operator,
      threshold: input.threshold,
      isActive: input.isActive,
    },
  });
};

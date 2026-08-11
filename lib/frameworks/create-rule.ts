import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isRuleOperator } from "@/lib/frameworks/consts";
import { FrameworkError } from "@/lib/frameworks/errors";

export interface CreateRuleInput {
  groupId: string;
  metricKey: string;
  operator: string;
  threshold: number;
}

// Every rule is a classification rule for now — signal rules (trim/buy
// more/sell/hold) are deferred to v2, not enough reliable metric data yet
// for them to behave sensibly.
export const createRule = async (input: CreateRuleInput, db: PrismaClient = prisma) => {
  const metricKey = input.metricKey.trim();

  if (metricKey.length === 0) {
    throw new FrameworkError("ruleMetricKeyRequired", "Metric key is required");
  }

  if (!isRuleOperator(input.operator)) {
    throw new FrameworkError("ruleOperatorInvalid", `Unrecognized operator "${input.operator}"`);
  }

  return db.groupRule.create({
    data: {
      groupId: input.groupId,
      metricKey,
      operator: input.operator,
      threshold: input.threshold,
      role: "classification",
    },
  });
};

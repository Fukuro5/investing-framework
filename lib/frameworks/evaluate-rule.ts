import { isRuleOperator, type RULE_OPERATORS } from "@/lib/frameworks/consts";

export type RuleEvaluationStatus = "ok" | "warn" | "breach";
type RuleOperator = (typeof RULE_OPERATORS)[number];

const compare = (value: number, operator: RuleOperator, threshold: number): boolean => {
  switch (operator) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "eq":
      return value === threshold;
  }
};

// "ok" = the rule's condition holds (metric satisfies the threshold);
// "breach" = it doesn't; "warn" = there's no resolved metric value to
// evaluate against at all (missing data flagged as attention-needed,
// rather than silently defaulting to ok or breach — see
// lib/metrics/resolve-metric-value.ts for how a value gets resolved).
export const evaluateRule = (operator: string, threshold: number, resolvedValue: number | null): RuleEvaluationStatus => {
  if (resolvedValue === null) {
    return "warn";
  }

  if (!isRuleOperator(operator)) {
    throw new Error(`Unrecognized rule operator "${operator}"`);
  }

  return compare(resolvedValue, operator, threshold) ? "ok" : "breach";
};

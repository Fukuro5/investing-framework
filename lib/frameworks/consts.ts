export const ASSIGNMENT_SOURCES = ["manual", "auto"] as const;

// A framework's groups' target allocation bands must sum to exactly this —
// PLANNING.md §3/§5/§9.
export const REQUIRED_GROUP_ALLOCATION_TOTAL = 100;

// Sentinel <select> value representing "no group" in the assignment UI —
// never a real FrameworkGroup.id, so it can't collide with one.
export const UNCLASSIFIED_ASSIGNMENT_VALUE = "unclassified";

export const RULE_OPERATORS = ["gt", "gte", "lt", "lte", "eq"] as const;

// GroupRule.operator is a plain String column (SQLite has no enum
// support), so a value read back from the database is only known to be a
// string until narrowed against the domain union.
export const isRuleOperator = (value: string): value is (typeof RULE_OPERATORS)[number] =>
  RULE_OPERATORS.includes(value as (typeof RULE_OPERATORS)[number]);

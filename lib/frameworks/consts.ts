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

// GroupRule.type discriminates allocation rules (group/position min-max
// bands) from metric rules (metricKey/operator/threshold) — PLANNING.md §1
// Phase 1. The type union itself is hardcoded; individual rule instances
// of either type stay fully user-managed via CRUD.
export const RULE_TYPES = ["allocation", "metric"] as const;

export const isRuleType = (value: string): value is (typeof RULE_TYPES)[number] =>
  RULE_TYPES.includes(value as (typeof RULE_TYPES)[number]);

// Only meaningful for type='allocation'. 'group' = the group's own target
// band — exactly one per group, created/edited alongside the group itself
// rather than through the generic rule UI. 'position' = an optional
// uniform band applied to every position currently in the group.
export const RULE_SCOPES = ["group", "position"] as const;

export const isRuleScope = (value: string): value is (typeof RULE_SCOPES)[number] =>
  RULE_SCOPES.includes(value as (typeof RULE_SCOPES)[number]);

// classification rules decide auto-membership; signal rules decide
// trim/buy-more/sell/hold once a position is already in the group. Only
// selectable for type='metric' rules — type='allocation' rules are always
// role='signal' (allocation never decides group membership).
export const RULE_ROLES = ["classification", "signal"] as const;

export const isRuleRole = (value: string): value is (typeof RULE_ROLES)[number] =>
  RULE_ROLES.includes(value as (typeof RULE_ROLES)[number]);

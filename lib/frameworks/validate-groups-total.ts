import { REQUIRED_GROUP_ALLOCATION_TOTAL } from "@/lib/frameworks/consts";

export interface GroupAllocationBand {
  minAllocation: number;
  maxAllocation: number;
}

export interface GroupsTotalValidation {
  isValid: boolean;
  minTotal: number;
  maxTotal: number;
}

interface GroupScopeAllocationRule {
  type: string;
  scope: string | null;
  minAllocation: number | null;
  maxAllocation: number | null;
}

// A group's own band lives on its type='allocation', scope='group' rule
// (PLANNING.md §1 Phase 1) — always present and fully populated by
// create-group.ts/update-group.ts, but the schema still types
// minAllocation/maxAllocation as nullable, so narrow explicitly rather
// than asserting.
export const resolveGroupAllocationBand = (rules: GroupScopeAllocationRule[]): GroupAllocationBand | null => {
  const groupRule = rules.find((rule) => rule.type === "allocation" && rule.scope === "group");

  if (!groupRule || groupRule.minAllocation === null || groupRule.maxAllocation === null) {
    return null;
  }

  return { minAllocation: groupRule.minAllocation, maxAllocation: groupRule.maxAllocation };
};

// PLANNING.md §3/§5/§9 says a framework's groups' bands "must sum to 100%".
// A band is a range, not a point, so the checkable form of that is: the
// bands must collectively bracket 100% — the sum of every group's minimum
// no more than 100, and the sum of every group's maximum no less than 100 —
// so there's always at least one way to allocate within every band that
// adds up to exactly 100%. Each band comes from a group's required
// type='allocation', scope='group' GroupRule (PLANNING.md §1 Phase 1).
export const validateGroupsTotal = (groups: GroupAllocationBand[]): GroupsTotalValidation => {
  const minTotal = groups.reduce((sum, group) => sum + group.minAllocation, 0);
  const maxTotal = groups.reduce((sum, group) => sum + group.maxAllocation, 0);

  return {
    isValid: minTotal <= REQUIRED_GROUP_ALLOCATION_TOTAL && maxTotal >= REQUIRED_GROUP_ALLOCATION_TOTAL,
    minTotal,
    maxTotal,
  };
};

import { REQUIRED_GROUP_ALLOCATION_TOTAL } from "@/lib/frameworks/consts";

export interface GroupAllocationBand {
  targetAllocationMin: number;
  targetAllocationMax: number;
}

export interface GroupsTotalValidation {
  isValid: boolean;
  minTotal: number;
  maxTotal: number;
}

// PLANNING.md §3/§5/§9 says a framework's groups' bands "must sum to 100%".
// A band is a range, not a point, so the checkable form of that is: the
// bands must collectively bracket 100% — the sum of every group's minimum
// no more than 100, and the sum of every group's maximum no less than 100 —
// so there's always at least one way to allocate within every band that
// adds up to exactly 100%.
export const validateGroupsTotal = (groups: GroupAllocationBand[]): GroupsTotalValidation => {
  const minTotal = groups.reduce((sum, group) => sum + group.targetAllocationMin, 0);
  const maxTotal = groups.reduce((sum, group) => sum + group.targetAllocationMax, 0);

  return {
    isValid: minTotal <= REQUIRED_GROUP_ALLOCATION_TOTAL && maxTotal >= REQUIRED_GROUP_ALLOCATION_TOTAL,
    minTotal,
    maxTotal,
  };
};

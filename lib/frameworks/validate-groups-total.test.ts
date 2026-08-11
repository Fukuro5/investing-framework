import { describe, expect, it } from "vitest";
import { validateGroupsTotal } from "@/lib/frameworks/validate-groups-total";

describe("validateGroupsTotal", () => {
  it("is valid when the min total is <= 100 and the max total is >= 100", () => {
    const result = validateGroupsTotal([
      { targetAllocationMin: 65, targetAllocationMax: 75 },
      { targetAllocationMin: 15, targetAllocationMax: 25 },
    ]);

    expect(result).toEqual({ isValid: true, minTotal: 80, maxTotal: 100 });
  });

  it("is invalid when even the max total can't reach 100", () => {
    const result = validateGroupsTotal([{ targetAllocationMin: 10, targetAllocationMax: 50 }]);

    expect(result.isValid).toBe(false);
  });

  it("is invalid when even the min total already exceeds 100", () => {
    const result = validateGroupsTotal([
      { targetAllocationMin: 60, targetAllocationMax: 80 },
      { targetAllocationMin: 60, targetAllocationMax: 80 },
    ]);

    expect(result.isValid).toBe(false);
  });

  it("is invalid for an empty group list (0 can't bracket 100)", () => {
    expect(validateGroupsTotal([]).isValid).toBe(false);
  });

  it("is valid at the exact boundary (bands with zero width summing to exactly 100)", () => {
    const result = validateGroupsTotal([
      { targetAllocationMin: 70, targetAllocationMax: 70 },
      { targetAllocationMin: 30, targetAllocationMax: 30 },
    ]);

    expect(result.isValid).toBe(true);
  });
});

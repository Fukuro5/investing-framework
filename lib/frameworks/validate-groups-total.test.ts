import { describe, expect, it } from "vitest";
import { validateGroupsTotal } from "@/lib/frameworks/validate-groups-total";

describe("validateGroupsTotal", () => {
  it("is valid when the min total is <= 100 and the max total is >= 100", () => {
    const result = validateGroupsTotal([
      { minAllocation: 65, maxAllocation: 75 },
      { minAllocation: 15, maxAllocation: 25 },
    ]);

    expect(result).toEqual({ isValid: true, minTotal: 80, maxTotal: 100 });
  });

  it("is invalid when even the max total can't reach 100", () => {
    const result = validateGroupsTotal([{ minAllocation: 10, maxAllocation: 50 }]);

    expect(result.isValid).toBe(false);
  });

  it("is invalid when even the min total already exceeds 100", () => {
    const result = validateGroupsTotal([
      { minAllocation: 60, maxAllocation: 80 },
      { minAllocation: 60, maxAllocation: 80 },
    ]);

    expect(result.isValid).toBe(false);
  });

  it("is invalid for an empty group list (0 can't bracket 100)", () => {
    expect(validateGroupsTotal([]).isValid).toBe(false);
  });

  it("is valid at the exact boundary (bands with zero width summing to exactly 100)", () => {
    const result = validateGroupsTotal([
      { minAllocation: 70, maxAllocation: 70 },
      { minAllocation: 30, maxAllocation: 30 },
    ]);

    expect(result.isValid).toBe(true);
  });
});

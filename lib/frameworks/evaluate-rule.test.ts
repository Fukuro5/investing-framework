import { describe, expect, it } from "vitest";
import { evaluateRule } from "@/lib/frameworks/evaluate-rule";

describe("evaluateRule", () => {
  it("returns warn when there's no resolved value to evaluate", () => {
    expect(evaluateRule("gt", 15, null)).toBe("warn");
  });

  it.each([
    ["gt", 15, 20, "ok"],
    ["gt", 15, 10, "breach"],
    ["gt", 15, 15, "breach"],
    ["gte", 15, 15, "ok"],
    ["lt", 15, 10, "ok"],
    ["lt", 15, 20, "breach"],
    ["lte", 15, 15, "ok"],
    ["eq", 15, 15, "ok"],
    ["eq", 15, 16, "breach"],
  ] as const)("%s %s against value %s -> %s", (operator, threshold, value, expected) => {
    expect(evaluateRule(operator, threshold, value)).toBe(expected);
  });

  it("throws for an unrecognized operator", () => {
    expect(() => evaluateRule("between", 15, 20)).toThrow(/Unrecognized rule operator/);
  });
});

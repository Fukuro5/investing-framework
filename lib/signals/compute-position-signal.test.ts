import { describe, expect, it } from "vitest";
import { computePositionSignal } from "@/lib/signals/compute-position-signal";

describe("computePositionSignal", () => {
  it.each([
    // health (thesis, metric breaches) x allocation action -> badge, matching
    // PLANNING.md §1 Phase 5's decision matrix exactly.
    ["holding", 0, "over", "trim"],
    ["holding", 0, "inBand", "hold"],
    ["holding", 0, "under", "buyMore"],
    ["partiallyWeakening", 0, "over", "trim"],
    ["partiallyWeakening", 0, "inBand", "hold"],
    ["partiallyWeakening", 0, "under", "hold"],
    ["broken", 0, "over", "sell"],
    ["broken", 0, "inBand", "sell"],
    ["broken", 0, "under", "sell"],
  ] as const)("thesis=%s, breaches=%s, allocation=%s -> %s", (thesisVerdict, breachCount, allocationAction, expectedBadge) => {
    const metricRuleStatuses = Array.from({ length: breachCount }, () => "breach" as const);
    const allocationBand = { minAllocation: 5, maxAllocation: 10 };
    const allocationPercent = allocationAction === "over" ? 15 : allocationAction === "under" ? 1 : 7;

    const result = computePositionSignal({ thesisVerdict, metricRuleStatuses, allocationPercent, allocationBand });

    expect(result.badge).toBe(expectedBadge);
  });

  it("treats a never-checked thesis (null verdict) as good, not penalized", () => {
    const result = computePositionSignal({
      thesisVerdict: null,
      metricRuleStatuses: [],
      allocationPercent: 7,
      allocationBand: { minAllocation: 5, maxAllocation: 10 },
    });

    expect(result.thesisSeverity).toBe("good");
    expect(result.badge).toBe("hold");
  });

  it.each([
    [0, "good"],
    [1, "moderate"],
    [2, "moderate"],
    [3, "bad"],
    [4, "bad"],
  ] as const)("%s breaching signal metrics -> metric severity %s", (breachCount, expectedSeverity) => {
    const metricRuleStatuses = Array.from({ length: breachCount }, () => "breach" as const);

    const result = computePositionSignal({
      thesisVerdict: "holding",
      metricRuleStatuses,
      allocationPercent: null,
      allocationBand: null,
    });

    expect(result.metricSeverity).toBe(expectedSeverity);
  });

  it("doesn't count 'warn' (missing metric data) as underperforming", () => {
    const result = computePositionSignal({
      thesisVerdict: "holding",
      metricRuleStatuses: ["warn", "warn", "warn"],
      allocationPercent: null,
      allocationBand: null,
    });

    expect(result.metricSeverity).toBe("good");
    expect(result.underperformingMetricCount).toBe(0);
  });

  it("health is the worst of thesis and metric severity", () => {
    const result = computePositionSignal({
      thesisVerdict: "holding",
      metricRuleStatuses: ["breach", "breach", "breach"],
      allocationPercent: null,
      allocationBand: null,
    });

    expect(result.thesisSeverity).toBe("good");
    expect(result.metricSeverity).toBe("bad");
    expect(result.health).toBe("bad");
  });

  it("treats a missing allocation band or unresolved allocation percent as in-band (neutral)", () => {
    const noBand = computePositionSignal({
      thesisVerdict: "holding",
      metricRuleStatuses: [],
      allocationPercent: 50,
      allocationBand: null,
    });
    const noPercent = computePositionSignal({
      thesisVerdict: "holding",
      metricRuleStatuses: [],
      allocationPercent: null,
      allocationBand: { minAllocation: 5, maxAllocation: 10 },
    });

    expect(noBand.allocationAction).toBe("inBand");
    expect(noBand.badge).toBe("hold");
    expect(noPercent.allocationAction).toBe("inBand");
    expect(noPercent.badge).toBe("hold");
  });
});

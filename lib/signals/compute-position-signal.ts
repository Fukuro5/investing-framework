import type { ThesisVerdict } from "@/lib/ai/types";
import type { RuleEvaluationStatus } from "@/lib/frameworks/evaluate-rule";

export type SignalSeverity = "good" | "moderate" | "bad";
export type AllocationAction = "over" | "inBand" | "under";
export type SignalBadge = "trim" | "buyMore" | "sell" | "hold";

export interface AllocationBand {
  minAllocation: number;
  maxAllocation: number;
}

export interface ComputePositionSignalInput {
  // null = no ThesisVerdict has ever been recorded for this instrument
  // (thesis not written yet, or never checked against a filing) — treated
  // as "good" rather than penalized, since an unchecked position isn't
  // known to have a problem (PLANNING.md §1 Phase 5).
  thesisVerdict: ThesisVerdict | null;
  // One entry per active type='metric', role='signal' GroupRule in the
  // position's group — "warn" (no resolved metric value) doesn't count as
  // underperforming, only "breach" does.
  metricRuleStatuses: RuleEvaluationStatus[];
  // Portfolio-wide allocation % for this position (null when its USD value
  // can't be resolved yet — see lib/dashboard/allocation.ts).
  allocationPercent: number | null;
  // The group's type='allocation', scope='position' rule, if configured.
  allocationBand: AllocationBand | null;
}

export interface PositionSignalResult {
  badge: SignalBadge;
  health: SignalSeverity;
  thesisSeverity: SignalSeverity;
  metricSeverity: SignalSeverity;
  allocationAction: AllocationAction;
  underperformingMetricCount: number;
}

const THESIS_SEVERITY_BY_VERDICT: Record<ThesisVerdict, SignalSeverity> = {
  broken: "bad",
  partiallyWeakening: "moderate",
  holding: "good",
};

const SEVERITY_RANK: Record<SignalSeverity, number> = { good: 0, moderate: 1, bad: 2 };

const worstSeverity = (a: SignalSeverity, b: SignalSeverity): SignalSeverity => (SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b);

// PLANNING.md §1 Phase 5: underperforming on 3+ signal metrics is bad,
// 1-2 is moderate, none is good.
const resolveMetricSeverity = (underperformingMetricCount: number): SignalSeverity => {
  if (underperformingMetricCount >= 3) {
    return "bad";
  }

  if (underperformingMetricCount >= 1) {
    return "moderate";
  }

  return "good";
};

// No configured band, or an unresolved allocation %, means there's nothing
// to size against — treated as in-band (neutral) rather than guessed.
const resolveAllocationAction = (allocationPercent: number | null, band: AllocationBand | null): AllocationAction => {
  if (allocationPercent === null || band === null) {
    return "inBand";
  }

  if (allocationPercent > band.maxAllocation) {
    return "over";
  }

  if (allocationPercent < band.minAllocation) {
    return "under";
  }

  return "inBand";
};

// PLANNING.md §1 Phase 5 decision matrix, "good"/"moderate" rows only —
// health="bad" dominates unconditionally (always "sell", see below)
// regardless of allocation, so it's not part of this lookup.
const BADGE_BY_HEALTH_AND_ALLOCATION: Record<"good" | "moderate", Record<AllocationAction, SignalBadge>> = {
  moderate: { over: "trim", inBand: "hold", under: "hold" },
  good: { over: "trim", inBand: "hold", under: "buyMore" },
};

export const computePositionSignal = (input: ComputePositionSignalInput): PositionSignalResult => {
  const thesisSeverity = input.thesisVerdict ? THESIS_SEVERITY_BY_VERDICT[input.thesisVerdict] : "good";
  const underperformingMetricCount = input.metricRuleStatuses.filter((status) => status === "breach").length;
  const metricSeverity = resolveMetricSeverity(underperformingMetricCount);
  const health = worstSeverity(thesisSeverity, metricSeverity);
  const allocationAction = resolveAllocationAction(input.allocationPercent, input.allocationBand);
  const badge: SignalBadge = health === "bad" ? "sell" : BADGE_BY_HEALTH_AND_ALLOCATION[health][allocationAction];

  return {
    badge,
    health,
    thesisSeverity,
    metricSeverity,
    allocationAction,
    underperformingMetricCount,
  };
};

import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ThesisVerdict } from "@/lib/ai/types";
import { withAllocationPercent } from "@/lib/dashboard/allocation";
import { getPositions } from "@/lib/dashboard/get-positions";
import type { PositionView } from "@/lib/dashboard/types";
import { evaluateRule, type RuleEvaluationStatus } from "@/lib/frameworks/evaluate-rule";
import { resolveMetricValue } from "@/lib/metrics/resolve-metric-value";
import { computePositionSignal, type AllocationBand, type PositionSignalResult } from "@/lib/signals/compute-position-signal";
import { getLatestThesisVerdict } from "@/lib/thesis/get-latest-thesis-verdict";

export interface PositionSignalView extends PositionSignalResult {
  instrumentId: string;
  thesisVerdict: ThesisVerdict | null;
  thesisExplanation: string | null;
  underperformingMetricKeys: string[];
  totalSignalMetricRuleCount: number;
  allocationPercent: number | null;
  allocationBand: AllocationBand | null;
}

export interface ActiveFrameworkPositionSignals {
  framework: { id: string; name: string };
  signalByInstrumentId: Map<string, PositionSignalView>;
}

interface GroupWithRules {
  rules: {
    type: string;
    scope: string | null;
    role: string;
    isActive: boolean;
    metricKey: string | null;
    operator: string | null;
    threshold: number | null;
    minAllocation: number | null;
    maxAllocation: number | null;
  }[];
}

const evaluateSignalMetricRules = async (
  instrumentId: string,
  rules: GroupWithRules["rules"],
  db: PrismaClient,
): Promise<{ statuses: RuleEvaluationStatus[]; underperformingMetricKeys: string[] }> => {
  const signalMetricRules = rules.filter((rule) => rule.type === "metric" && rule.role === "signal" && rule.isActive);

  const statuses = await Promise.all(
    signalMetricRules.map(async (rule): Promise<RuleEvaluationStatus> => {
      if (rule.metricKey === null || rule.operator === null || rule.threshold === null) {
        return "warn";
      }

      const resolved = await resolveMetricValue(instrumentId, rule.metricKey, db);
      return evaluateRule(rule.operator, rule.threshold, resolved?.value ?? null);
    }),
  );

  const underperformingMetricKeys = signalMetricRules.flatMap((rule, index) =>
    statuses[index] === "breach" && rule.metricKey !== null ? [rule.metricKey] : [],
  );

  return { statuses, underperformingMetricKeys };
};

const resolveAllocationBand = (rules: GroupWithRules["rules"]): AllocationBand | null => {
  const rule = rules.find((candidate) => candidate.type === "allocation" && candidate.scope === "position" && candidate.isActive);

  if (!rule || rule.minAllocation === null || rule.maxAllocation === null) {
    return null;
  }

  return { minAllocation: rule.minAllocation, maxAllocation: rule.maxAllocation };
};

const computeSignalForPosition = async (
  position: PositionView,
  group: GroupWithRules,
  db: PrismaClient,
): Promise<PositionSignalView> => {
  const allocationBand = resolveAllocationBand(group.rules);

  const [thesis, { statuses, underperformingMetricKeys }] = await Promise.all([
    getLatestThesisVerdict(position.instrumentId, db),
    evaluateSignalMetricRules(position.instrumentId, group.rules, db),
  ]);

  const result = computePositionSignal({
    thesisVerdict: thesis?.verdict ?? null,
    metricRuleStatuses: statuses,
    allocationPercent: position.allocationPercent,
    allocationBand,
  });

  return {
    ...result,
    instrumentId: position.instrumentId,
    thesisVerdict: thesis?.verdict ?? null,
    thesisExplanation: thesis?.explanation ?? null,
    underperformingMetricKeys,
    totalSignalMetricRuleCount: group.rules.filter((rule) => rule.type === "metric" && rule.role === "signal" && rule.isActive).length,
    allocationPercent: position.allocationPercent,
    allocationBand,
  };
};

// Computed fresh on demand, like getActiveFrameworkAllocations — not
// persisted to the Signal table, whose schema (one row per single
// GroupRule evaluation) doesn't fit a three-input combined badge
// (PLANNING.md §1 Phase 5). Positions with no group assignment for the
// active framework are omitted — there's no group's rules/band to combine
// with, so no badge can be computed for them; they show as "unclassified"
// in the UI, same treatment as getActiveFrameworkAllocations gives them.
export const getActiveFrameworkPositionSignals = async (db: PrismaClient = prisma): Promise<ActiveFrameworkPositionSignals | null> => {
  const framework = await db.framework.findFirst({
    where: { isActive: true },
    include: { groups: { include: { rules: true } } },
  });

  if (!framework) {
    return null;
  }

  const [positions, assignments] = await Promise.all([
    withAllocationPercent(await getPositions(db)),
    db.instrumentGroupAssignment.findMany({ where: { frameworkId: framework.id } }),
  ]);

  const groupById = new Map(framework.groups.map((group) => [group.id, group]));
  const groupIdByInstrumentId = new Map(assignments.map((assignment) => [assignment.instrumentId, assignment.groupId]));

  const signalViews = await Promise.all(
    positions.flatMap((position) => {
      const groupId = groupIdByInstrumentId.get(position.instrumentId);
      const group = groupId ? groupById.get(groupId) : undefined;

      return group ? [computeSignalForPosition(position, group, db)] : [];
    }),
  );

  return {
    framework: { id: framework.id, name: framework.name },
    signalByInstrumentId: new Map(signalViews.map((signal) => [signal.instrumentId, signal])),
  };
};

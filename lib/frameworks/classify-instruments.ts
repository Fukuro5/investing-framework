import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPositions } from "@/lib/dashboard/get-positions";
import { evaluateRule } from "@/lib/frameworks/evaluate-rule";
import { resolveMetricValue } from "@/lib/metrics/resolve-metric-value";

export interface ClassifyInstrumentsResult {
  classifiedCount: number;
}

interface MetricRule {
  metricKey: string | null;
  operator: string | null;
  threshold: number | null;
}

interface EligibleGroup {
  id: string;
  rules: MetricRule[];
}

// The where clause already filters to type='metric', so metricKey/
// operator/threshold are always populated — narrow explicitly rather than
// asserting, since the schema still types them as nullable.
const isPopulatedMetricRule = (rule: MetricRule): rule is { metricKey: string; operator: string; threshold: number } =>
  rule.metricKey !== null && rule.operator !== null && rule.threshold !== null;

const matchesGroup = async (db: PrismaClient, instrumentId: string, rules: MetricRule[]): Promise<boolean> => {
  const results = await Promise.all(
    rules.filter(isPopulatedMetricRule).map(async (rule) => {
      const resolved = await resolveMetricValue(instrumentId, rule.metricKey, db);
      return evaluateRule(rule.operator, rule.threshold, resolved?.value ?? null) === "ok";
    }),
  );

  return results.every(Boolean);
};

// A group with zero active metric rules is never a candidate — a vacuous
// "matches everyone" auto-classification would be wrong (PLANNING.md §5).
// Every active type='metric' rule now doubles as a classification rule
// (PLANNING.md §1 Phase 4) — there's no separate role to filter on.
export const getEligibleGroupsForClassification = async (frameworkId: string, db: PrismaClient): Promise<EligibleGroup[]> => {
  const groups = await db.frameworkGroup.findMany({
    where: { frameworkId },
    orderBy: { priority: "asc" },
    include: { rules: { where: { type: "metric", isActive: true } } },
  });

  return groups.filter((group) => group.rules.length > 0);
};

// Groups are checked in priority order (ascending — lower wins ties); the
// first one whose rules all pass wins. Returns null if none match.
export const findMatchingGroupId = async (
  eligibleGroups: EligibleGroup[],
  instrumentId: string,
  db: PrismaClient,
): Promise<string | null> => {
  for (const group of eligibleGroups) {
    if (await matchesGroup(db, instrumentId, group.rules)) {
      return group.id;
    }
  }

  return null;
};

// Only fills in positions with no existing assignment for this framework —
// a manual (or a prior auto) assignment is never overwritten (PLANNING.md
// §5).
export const classifyInstruments = async (
  frameworkId: string,
  db: PrismaClient = prisma,
): Promise<ClassifyInstrumentsResult> => {
  const [eligibleGroups, assignments, positions] = await Promise.all([
    getEligibleGroupsForClassification(frameworkId, db),
    db.instrumentGroupAssignment.findMany({ where: { frameworkId }, select: { instrumentId: true } }),
    getPositions(db),
  ]);

  const assignedInstrumentIds = new Set(assignments.map((assignment) => assignment.instrumentId));

  let classifiedCount = 0;

  for (const position of positions) {
    if (assignedInstrumentIds.has(position.instrumentId)) {
      continue;
    }

    const groupId = await findMatchingGroupId(eligibleGroups, position.instrumentId, db);
    if (groupId) {
      await db.instrumentGroupAssignment.create({
        data: { frameworkId, groupId, instrumentId: position.instrumentId, source: "auto" },
      });
      classifiedCount += 1;
    }
  }

  return { classifiedCount };
};

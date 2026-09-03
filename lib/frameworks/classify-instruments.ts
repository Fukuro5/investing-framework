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

// Only fills in positions with no existing assignment for this framework —
// a manual (or a prior auto) assignment is never overwritten (PLANNING.md
// §5). A group with zero active classification rules is never a candidate
// — a vacuous "matches everyone" auto-classification would be wrong.
// Groups are checked in priority order (ascending — lower wins ties) and
// the first one whose rules all pass wins.
export const classifyInstruments = async (
  frameworkId: string,
  db: PrismaClient = prisma,
): Promise<ClassifyInstrumentsResult> => {
  const [groups, assignments, positions] = await Promise.all([
    db.frameworkGroup.findMany({
      where: { frameworkId },
      orderBy: { priority: "asc" },
      include: { rules: { where: { type: "metric", role: "classification", isActive: true } } },
    }),
    db.instrumentGroupAssignment.findMany({ where: { frameworkId }, select: { instrumentId: true } }),
    getPositions(db),
  ]);

  const assignedInstrumentIds = new Set(assignments.map((assignment) => assignment.instrumentId));
  const eligibleGroups = groups.filter((group) => group.rules.length > 0);

  let classifiedCount = 0;

  for (const position of positions) {
    if (assignedInstrumentIds.has(position.instrumentId)) {
      continue;
    }

    for (const group of eligibleGroups) {
      if (await matchesGroup(db, position.instrumentId, group.rules)) {
        await db.instrumentGroupAssignment.create({
          data: { frameworkId, groupId: group.id, instrumentId: position.instrumentId, source: "auto" },
        });
        classifiedCount += 1;
        break;
      }
    }
  }

  return { classifiedCount };
};

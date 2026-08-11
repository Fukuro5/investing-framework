import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPositions } from "@/lib/dashboard/get-positions";
import { evaluateRule } from "@/lib/frameworks/evaluate-rule";
import { resolveMetricValue } from "@/lib/metrics/resolve-metric-value";

export interface ClassifyInstrumentsResult {
  classifiedCount: number;
}

const matchesGroup = async (
  db: PrismaClient,
  instrumentId: string,
  rules: { metricKey: string; operator: string; threshold: number }[],
): Promise<boolean> => {
  const results = await Promise.all(
    rules.map(async (rule) => {
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
      include: { rules: { where: { role: "classification", isActive: true } } },
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

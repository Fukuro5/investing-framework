import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAllocationPercent } from "@/lib/dashboard/allocation";
import { getPositions } from "@/lib/dashboard/get-positions";

export interface GroupAllocationView {
  groupId: string;
  name: string;
  targetAllocationMin: number;
  targetAllocationMax: number;
  currentAllocationPercent: number;
}

export interface ActiveFrameworkAllocations {
  framework: { id: string; name: string };
  groups: GroupAllocationView[];
  // Positions with no assignment for this framework — shown, not silently
  // dropped, per PLANNING.md §5.
  unclassifiedAllocationPercent: number;
}

// Recomputed fresh on every read, on demand — not persisted (that's the
// Signal table's job once Phase 5 adds rule-based evaluation). A position
// with an unknown USD value (allocationPercent null — e.g. non-USD with no
// cached FX rate, or no live price yet) simply doesn't contribute; it's
// still assignable, just invisible to this specific total until resolved.
export const getActiveFrameworkAllocations = async (db: PrismaClient = prisma): Promise<ActiveFrameworkAllocations | null> => {
  const framework = await db.framework.findFirst({
    where: { isActive: true },
    include: { groups: { orderBy: { priority: "asc" } } },
  });

  if (!framework) {
    return null;
  }

  const [positions, assignments] = await Promise.all([
    withAllocationPercent(await getPositions(db)),
    db.instrumentGroupAssignment.findMany({ where: { frameworkId: framework.id } }),
  ]);

  const groupIdByInstrumentId = new Map(assignments.map((assignment) => [assignment.instrumentId, assignment.groupId]));
  const allocationByGroupId = new Map<string, number>();
  let unclassifiedAllocationPercent = 0;

  for (const position of positions) {
    if (position.allocationPercent === null) {
      continue;
    }

    const groupId = groupIdByInstrumentId.get(position.instrumentId);
    if (!groupId) {
      unclassifiedAllocationPercent += position.allocationPercent;
      continue;
    }

    allocationByGroupId.set(groupId, (allocationByGroupId.get(groupId) ?? 0) + position.allocationPercent);
  }

  return {
    framework: { id: framework.id, name: framework.name },
    groups: framework.groups.map((group) => ({
      groupId: group.id,
      name: group.name,
      targetAllocationMin: group.targetAllocationMin,
      targetAllocationMax: group.targetAllocationMax,
      currentAllocationPercent: allocationByGroupId.get(group.id) ?? 0,
    })),
    unclassifiedAllocationPercent,
  };
};

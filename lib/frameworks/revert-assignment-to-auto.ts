import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findMatchingGroupId, getEligibleGroupsForClassification } from "@/lib/frameworks/classify-instruments";

export interface RevertAssignmentToAutoResult {
  groupId: string | null;
}

// Undoes a manual override for one instrument: deletes its manual
// InstrumentGroupAssignment row, then re-runs the same per-instrument
// matching logic classifyInstruments uses in bulk, landing it in whatever
// group its current metrics qualify for — or unclassified if none match
// (PLANNING.md §1 Phase 4).
export const revertAssignmentToAuto = async (
  frameworkId: string,
  instrumentId: string,
  db: PrismaClient = prisma,
): Promise<RevertAssignmentToAutoResult> => {
  await db.instrumentGroupAssignment.deleteMany({ where: { frameworkId, instrumentId, source: "manual" } });

  const eligibleGroups = await getEligibleGroupsForClassification(frameworkId, db);
  const groupId = await findMatchingGroupId(eligibleGroups, instrumentId, db);

  if (groupId) {
    await db.instrumentGroupAssignment.create({
      data: { frameworkId, groupId, instrumentId, source: "auto" },
    });
  }

  return { groupId };
};

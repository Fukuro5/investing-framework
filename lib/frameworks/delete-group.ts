import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FrameworkError } from "@/lib/frameworks/errors";

export class GroupHasAssignmentsError extends FrameworkError {
  constructor(count: number) {
    super(
      "groupHasAssignments",
      `This group still has ${count} instrument(s) assigned — reassign them before deleting it`,
      { count },
    );
  }
}

// Unlike deleting a whole framework (see delete-framework.ts), deleting a
// single group blocks if instruments are still assigned to it rather than
// silently unassigning them — losing track of where a position "should"
// sit is more likely to be an accidental click than an intentional cleanup.
export const deleteGroup = async (groupId: string, db: PrismaClient = prisma) => {
  const assignmentCount = await db.instrumentGroupAssignment.count({ where: { groupId } });

  if (assignmentCount > 0) {
    throw new GroupHasAssignmentsError(assignmentCount);
  }

  await db.$transaction([
    db.groupRule.deleteMany({ where: { groupId } }),
    db.frameworkGroup.delete({ where: { id: groupId } }),
  ]);
};

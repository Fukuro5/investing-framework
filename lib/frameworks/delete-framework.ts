import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Deleting a framework is a deliberate "delete everything scoped to just
// this framework" action — unlike deleting a single group (see
// delete-group.ts), which blocks instead if instruments are still
// assigned, since that's more likely to be an accidental click. Cascades
// through Signal/GroupRule too even though Phase 4 never creates any, so
// this keeps working once Phase 5 does.
export const deleteFramework = (frameworkId: string, db: PrismaClient = prisma) =>
  db.$transaction(async (tx) => {
    const groups = await tx.frameworkGroup.findMany({ where: { frameworkId }, select: { id: true } });
    const groupIds = groups.map((group) => group.id);

    await tx.signal.deleteMany({ where: { frameworkId } });
    await tx.groupRule.deleteMany({ where: { groupId: { in: groupIds } } });
    await tx.instrumentGroupAssignment.deleteMany({ where: { frameworkId } });
    await tx.frameworkGroup.deleteMany({ where: { frameworkId } });
    await tx.framework.delete({ where: { id: frameworkId } });
  });

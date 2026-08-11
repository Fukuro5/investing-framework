import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FrameworkError } from "@/lib/frameworks/errors";
import { validateGroupsTotal } from "@/lib/frameworks/validate-groups-total";

export class GroupsNotFullyAllocatedError extends FrameworkError {
  constructor(frameworkId: string) {
    super(
      "groupsNotFullyAllocated",
      `Framework ${frameworkId}'s groups don't bracket 100% yet — adjust the target bands before activating`,
    );
  }
}

// Only one framework is "active" at a time (PLANNING.md §5). Activation is
// where the 100%-total rule actually gets enforced — see
// validate-groups-total.ts for why it isn't enforced on every individual
// group edit instead.
export const setActiveFramework = async (frameworkId: string, db: PrismaClient = prisma) => {
  const groups = await db.frameworkGroup.findMany({
    where: { frameworkId },
    select: { targetAllocationMin: true, targetAllocationMax: true },
  });

  if (!validateGroupsTotal(groups).isValid) {
    throw new GroupsNotFullyAllocatedError(frameworkId);
  }

  await db.$transaction([
    db.framework.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    db.framework.update({ where: { id: frameworkId }, data: { isActive: true } }),
  ]);
};

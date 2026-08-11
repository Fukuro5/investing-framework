import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateGroupsTotal } from "@/lib/frameworks/validate-groups-total";

export const getFrameworkDetail = async (frameworkId: string, db: PrismaClient = prisma) => {
  const framework = await db.framework.findUniqueOrThrow({
    where: { id: frameworkId },
    include: { groups: { orderBy: { priority: "asc" } } },
  });

  const assignments = await db.instrumentGroupAssignment.findMany({
    where: { frameworkId },
    include: { instrument: true },
  });

  return {
    framework,
    assignments,
    groupsTotal: validateGroupsTotal(framework.groups),
  };
};

import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveGroupAllocationBand, validateGroupsTotal } from "@/lib/frameworks/validate-groups-total";

export const getFrameworkDetail = async (frameworkId: string, db: PrismaClient = prisma) => {
  const framework = await db.framework.findUniqueOrThrow({
    where: { id: frameworkId },
    include: {
      groups: {
        orderBy: { priority: "asc" },
        include: { rules: { orderBy: [{ type: "asc" }, { metricKey: "asc" }] } },
      },
    },
  });

  const assignments = await db.instrumentGroupAssignment.findMany({
    where: { frameworkId },
    include: { instrument: true },
  });

  const groupBands = framework.groups
    .map((group) => resolveGroupAllocationBand(group.rules))
    .filter((band) => band !== null);

  return {
    framework,
    assignments,
    groupsTotal: validateGroupsTotal(groupBands),
  };
};

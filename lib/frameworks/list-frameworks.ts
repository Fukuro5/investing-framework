import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const listFrameworks = (db: PrismaClient = prisma) =>
  db.framework.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { groups: true } } },
  });

import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const deleteRule = (ruleId: string, db: PrismaClient = prisma) => db.groupRule.delete({ where: { id: ruleId } });

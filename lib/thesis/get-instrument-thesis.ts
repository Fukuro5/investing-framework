import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const getInstrumentThesis = async (instrumentId: string, db: PrismaClient = prisma): Promise<string> => {
  const thesis = await db.thesis.findUnique({ where: { instrumentId } });
  return thesis?.content ?? "";
};

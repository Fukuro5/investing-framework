import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface AssignInstrumentInput {
  frameworkId: string;
  groupId: string;
  instrumentId: string;
}

// Manual assignments always win over auto-classification (PLANNING.md §5)
// — Phase 4 only ever writes source: "manual"; Phase 5's auto-classifier
// will need to check for an existing row here before writing its own.
export const assignInstrument = (input: AssignInstrumentInput, db: PrismaClient = prisma) =>
  db.instrumentGroupAssignment.upsert({
    where: { frameworkId_instrumentId: { frameworkId: input.frameworkId, instrumentId: input.instrumentId } },
    update: { groupId: input.groupId, source: "manual", assignedAt: new Date() },
    create: {
      frameworkId: input.frameworkId,
      groupId: input.groupId,
      instrumentId: input.instrumentId,
      source: "manual",
    },
  });

export const unassignInstrument = (frameworkId: string, instrumentId: string, db: PrismaClient = prisma) =>
  db.instrumentGroupAssignment.deleteMany({ where: { frameworkId, instrumentId } });

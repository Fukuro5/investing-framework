import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface UpsertThesisInput {
  instrumentId: string;
  content: string;
}

// One thesis per Instrument, shared across every framework — no versioning,
// editable in place (PLANNING.md §1 Phase 2).
export const upsertThesis = async (input: UpsertThesisInput, db: PrismaClient = prisma) => {
  const content = input.content.trim();

  return db.thesis.upsert({
    where: { instrumentId: input.instrumentId },
    update: { content },
    create: { instrumentId: input.instrumentId, content },
  });
};

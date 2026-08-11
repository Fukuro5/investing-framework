import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FrameworkError } from "@/lib/frameworks/errors";

export interface UpdateFrameworkInput {
  frameworkId: string;
  name: string;
  description: string | null;
}

export const updateFramework = async (input: UpdateFrameworkInput, db: PrismaClient = prisma) => {
  const name = input.name.trim();

  if (name.length === 0) {
    throw new FrameworkError("frameworkNameRequired", "Framework name is required");
  }

  const current = await db.framework.findUniqueOrThrow({ where: { id: input.frameworkId } });

  if (name !== current.name) {
    const existing = await db.framework.findUnique({ where: { name } });
    if (existing) {
      throw new FrameworkError("frameworkNameTaken", `A framework named "${name}" already exists`, { name });
    }
  }

  return db.framework.update({
    where: { id: input.frameworkId },
    data: { name, description: input.description },
  });
};

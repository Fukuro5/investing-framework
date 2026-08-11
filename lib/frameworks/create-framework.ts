import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FrameworkError } from "@/lib/frameworks/errors";

export interface CreateFrameworkInput {
  name: string;
  description: string | null;
}

export const createFramework = async (input: CreateFrameworkInput, db: PrismaClient = prisma) => {
  const name = input.name.trim();

  if (name.length === 0) {
    throw new FrameworkError("frameworkNameRequired", "Framework name is required");
  }

  const existing = await db.framework.findUnique({ where: { name } });
  if (existing) {
    throw new FrameworkError("frameworkNameTaken", `A framework named "${name}" already exists`, { name });
  }

  return db.framework.create({ data: { name, description: input.description } });
};

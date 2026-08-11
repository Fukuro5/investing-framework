import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FrameworkError } from "@/lib/frameworks/errors";

export interface CreateGroupInput {
  frameworkId: string;
  name: string;
  targetAllocationMin: number;
  targetAllocationMax: number;
  priority: number;
}

const validate = (input: CreateGroupInput) => {
  if (input.name.trim().length === 0) {
    throw new FrameworkError("groupNameRequired", "Group name is required");
  }

  if (input.targetAllocationMin < 0 || input.targetAllocationMax > 100) {
    throw new FrameworkError("groupAllocationOutOfRange", "Target allocation must be between 0 and 100");
  }

  if (input.targetAllocationMin > input.targetAllocationMax) {
    throw new FrameworkError("groupMinGreaterThanMax", "Target allocation minimum can't be greater than the maximum");
  }
};

export const createGroup = async (input: CreateGroupInput, db: PrismaClient = prisma) => {
  validate(input);
  const name = input.name.trim();

  const existing = await db.frameworkGroup.findUnique({
    where: { frameworkId_name: { frameworkId: input.frameworkId, name } },
  });
  if (existing) {
    throw new FrameworkError("groupNameTaken", `This framework already has a group named "${name}"`, { name });
  }

  return db.frameworkGroup.create({
    data: {
      frameworkId: input.frameworkId,
      name,
      targetAllocationMin: input.targetAllocationMin,
      targetAllocationMax: input.targetAllocationMax,
      priority: input.priority,
    },
  });
};

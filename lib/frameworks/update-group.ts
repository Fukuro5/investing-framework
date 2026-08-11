import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FrameworkError } from "@/lib/frameworks/errors";

export interface UpdateGroupInput {
  groupId: string;
  name: string;
  targetAllocationMin: number;
  targetAllocationMax: number;
  priority: number;
}

const validate = (input: UpdateGroupInput) => {
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

export const updateGroup = async (input: UpdateGroupInput, db: PrismaClient = prisma) => {
  validate(input);
  const name = input.name.trim();

  const current = await db.frameworkGroup.findUniqueOrThrow({ where: { id: input.groupId } });

  if (name !== current.name) {
    const existing = await db.frameworkGroup.findUnique({
      where: { frameworkId_name: { frameworkId: current.frameworkId, name } },
    });
    if (existing) {
      throw new FrameworkError("groupNameTaken", `This framework already has a group named "${name}"`, { name });
    }
  }

  return db.frameworkGroup.update({
    where: { id: input.groupId },
    data: {
      name,
      targetAllocationMin: input.targetAllocationMin,
      targetAllocationMax: input.targetAllocationMax,
      priority: input.priority,
    },
  });
};

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

// Every group requires exactly one type='allocation', scope='group' rule
// (its own target band) — created transactionally alongside the group
// itself rather than as a separate step, so a group is never left without
// its required band (PLANNING.md §1 Phase 1).
export const createGroup = async (input: CreateGroupInput, db: PrismaClient = prisma) => {
  validate(input);
  const name = input.name.trim();

  const existing = await db.frameworkGroup.findUnique({
    where: { frameworkId_name: { frameworkId: input.frameworkId, name } },
  });
  if (existing) {
    throw new FrameworkError("groupNameTaken", `This framework already has a group named "${name}"`, { name });
  }

  return db.$transaction(async (tx) => {
    const group = await tx.frameworkGroup.create({
      data: {
        frameworkId: input.frameworkId,
        name,
        priority: input.priority,
      },
    });

    await tx.groupRule.create({
      data: {
        groupId: group.id,
        type: "allocation",
        scope: "group",
        minAllocation: input.targetAllocationMin,
        maxAllocation: input.targetAllocationMax,
        role: "signal",
      },
    });

    return group;
  });
};

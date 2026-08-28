import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FrameworkError } from "@/lib/frameworks/errors";

// A group's own type='allocation', scope='group' rule is mandatory — it's
// created/updated alongside the group itself (see create-group.ts,
// update-group.ts) and can't be deleted independently of the group.
export const deleteRule = async (ruleId: string, db: PrismaClient = prisma) => {
  const rule = await db.groupRule.findUniqueOrThrow({ where: { id: ruleId } });

  if (rule.type === "allocation" && rule.scope === "group") {
    throw new FrameworkError(
      "ruleGroupScopeCannotBeDeleted",
      "A group's own allocation band can't be deleted — delete the group instead",
    );
  }

  return db.groupRule.delete({ where: { id: ruleId } });
};

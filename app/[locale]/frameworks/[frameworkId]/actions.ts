"use server";

import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DeleteActionState } from "@/components/DeleteButton";
import { assignInstrument, unassignInstrument } from "@/lib/frameworks/assign-instrument";
import { UNCLASSIFIED_ASSIGNMENT_VALUE } from "@/lib/frameworks/consts";
import { createGroup } from "@/lib/frameworks/create-group";
import { deleteGroup } from "@/lib/frameworks/delete-group";
import { FrameworkError } from "@/lib/frameworks/errors";
import { resolveFrameworkErrorMessage } from "@/lib/frameworks/resolve-error-message";
import { updateFramework } from "@/lib/frameworks/update-framework";
import { updateGroup } from "@/lib/frameworks/update-group";

export interface FormState {
  status: "idle" | "error";
  errorMessage?: string;
}

const toErrorState = async (error: unknown): Promise<FormState> => ({
  status: "error",
  errorMessage: await resolveFrameworkErrorMessage(error),
});

const readNumber = (formData: FormData, key: string): number => {
  const value = Number(formData.get(key));
  if (Number.isNaN(value)) {
    throw new FrameworkError("groupFieldMustBeNumber", `"${key}" must be a number`, { field: key });
  }
  return value;
};

export const updateFrameworkAction = async (
  _previousState: FormState,
  formData: FormData,
  db: PrismaClient = prisma,
): Promise<FormState> => {
  try {
    await updateFramework(
      {
        frameworkId: String(formData.get("frameworkId") ?? ""),
        name: String(formData.get("name") ?? ""),
        description:
          typeof formData.get("description") === "string" && String(formData.get("description")).trim().length > 0
            ? String(formData.get("description"))
            : null,
      },
      db,
    );
  } catch (error) {
    return await toErrorState(error);
  }

  return { status: "idle" };
};

export const createGroupAction = async (
  _previousState: FormState,
  formData: FormData,
  db: PrismaClient = prisma,
): Promise<FormState> => {
  try {
    await createGroup(
      {
        frameworkId: String(formData.get("frameworkId") ?? ""),
        name: String(formData.get("name") ?? ""),
        targetAllocationMin: readNumber(formData, "targetAllocationMin"),
        targetAllocationMax: readNumber(formData, "targetAllocationMax"),
        priority: readNumber(formData, "priority"),
      },
      db,
    );
  } catch (error) {
    return await toErrorState(error);
  }

  return { status: "idle" };
};

export const updateGroupAction = async (
  _previousState: FormState,
  formData: FormData,
  db: PrismaClient = prisma,
): Promise<FormState> => {
  try {
    await updateGroup(
      {
        groupId: String(formData.get("groupId") ?? ""),
        name: String(formData.get("name") ?? ""),
        targetAllocationMin: readNumber(formData, "targetAllocationMin"),
        targetAllocationMax: readNumber(formData, "targetAllocationMax"),
        priority: readNumber(formData, "priority"),
      },
      db,
    );
  } catch (error) {
    return await toErrorState(error);
  }

  return { status: "idle" };
};

export const deleteGroupAction = async (
  _previousState: DeleteActionState,
  formData: FormData,
  db: PrismaClient = prisma,
): Promise<DeleteActionState> => {
  try {
    await deleteGroup(String(formData.get("groupId") ?? ""), db);
  } catch (error) {
    return await toErrorState(error);
  }

  return { status: "idle" };
};

export const assignInstrumentAction = async (formData: FormData, db: PrismaClient = prisma): Promise<void> => {
  const frameworkId = String(formData.get("frameworkId") ?? "");
  const instrumentId = String(formData.get("instrumentId") ?? "");
  const groupId = String(formData.get("groupId") ?? "");

  if (groupId === UNCLASSIFIED_ASSIGNMENT_VALUE) {
    await unassignInstrument(frameworkId, instrumentId, db);
    return;
  }

  await assignInstrument({ frameworkId, groupId, instrumentId }, db);
};

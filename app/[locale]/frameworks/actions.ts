"use server";

import type { PrismaClient } from "@prisma/client";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import type { DeleteActionState } from "@/components/DeleteButton";
import { createFramework } from "@/lib/frameworks/create-framework";
import { deleteFramework } from "@/lib/frameworks/delete-framework";
import { resolveFrameworkErrorMessage } from "@/lib/frameworks/resolve-error-message";
import { setActiveFramework } from "@/lib/frameworks/set-active-framework";

export interface CreateFrameworkState {
  status: "idle" | "error";
  errorMessage?: string;
}

export const createFrameworkAction = async (
  _previousState: CreateFrameworkState,
  formData: FormData,
  db: PrismaClient = prisma,
): Promise<CreateFrameworkState> => {
  const name = String(formData.get("name") ?? "");
  const descriptionRaw = formData.get("description");
  const description = typeof descriptionRaw === "string" && descriptionRaw.trim().length > 0 ? descriptionRaw : null;

  let framework;
  try {
    framework = await createFramework({ name, description }, db);
  } catch (error) {
    return { status: "error", errorMessage: await resolveFrameworkErrorMessage(error) };
  }

  const locale = await getLocale();
  return redirect({ href: `/frameworks/${framework.id}`, locale });
};

export const deleteFrameworkAction = async (
  _previousState: DeleteActionState,
  formData: FormData,
  db: PrismaClient = prisma,
): Promise<DeleteActionState> => {
  const frameworkId = String(formData.get("frameworkId") ?? "");

  try {
    await deleteFramework(frameworkId, db);
  } catch (error) {
    return { status: "error", errorMessage: await resolveFrameworkErrorMessage(error) };
  }

  return { status: "idle" };
};

export interface ActivateFrameworkState {
  status: "idle" | "error";
  errorMessage?: string;
}

export const activateFrameworkAction = async (
  _previousState: ActivateFrameworkState,
  formData: FormData,
  db: PrismaClient = prisma,
): Promise<ActivateFrameworkState> => {
  const frameworkId = String(formData.get("frameworkId") ?? "");

  try {
    await setActiveFramework(frameworkId, db);
  } catch (error) {
    return { status: "error", errorMessage: await resolveFrameworkErrorMessage(error) };
  }

  return { status: "idle" };
};

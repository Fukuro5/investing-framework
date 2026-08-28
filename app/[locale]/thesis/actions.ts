"use server";

import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveThesisErrorMessage } from "@/lib/thesis/resolve-error-message";
import { upsertThesis } from "@/lib/thesis/upsert-thesis";

export interface UpsertThesisState {
  status: "idle" | "error";
  errorMessage?: string;
}

export const upsertThesisAction = async (
  _previousState: UpsertThesisState,
  formData: FormData,
  db: PrismaClient = prisma,
): Promise<UpsertThesisState> => {
  try {
    await upsertThesis(
      { instrumentId: String(formData.get("instrumentId") ?? ""), content: String(formData.get("content") ?? "") },
      db,
    );
  } catch {
    return { status: "error", errorMessage: await resolveThesisErrorMessage() };
  }

  return { status: "idle" };
};

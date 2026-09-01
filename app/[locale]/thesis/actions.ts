"use server";

import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveThesisErrorMessage } from "@/lib/thesis/resolve-error-message";
import { upsertThesis } from "@/lib/thesis/upsert-thesis";
import { checkInstrumentForUpdates } from "@/lib/edgar/check-instrument-for-updates";
import { getConfiguredUserAgent } from "@/lib/edgar/get-configured-user-agent";
import { resolveEdgarErrorMessage } from "@/lib/edgar/resolve-error-message";
import type { FinancialsTrendVerdict } from "@/lib/edgar/compute-financials-trend";

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

export interface CheckEdgarUpdatesState {
  status: "idle" | "upToDate" | "updated" | "error";
  verdict?: FinancialsTrendVerdict;
  errorMessage?: string;
}

// `db`/`userAgent` are only ever passed explicitly in tests — see
// refreshMarketDataAction in app/[locale]/actions.ts for the same pattern.
export const checkEdgarUpdatesAction = async (
  _previousState: CheckEdgarUpdatesState,
  formData: FormData,
  db: PrismaClient = prisma,
  userAgent?: string,
): Promise<CheckEdgarUpdatesState> => {
  try {
    const instrumentId = String(formData.get("instrumentId") ?? "");
    const result = await checkInstrumentForUpdates(instrumentId, userAgent ?? getConfiguredUserAgent(), db);

    return result.status === "upToDate" ? { status: "upToDate" } : { status: "updated", verdict: result.verdict };
  } catch (error) {
    return { status: "error", errorMessage: await resolveEdgarErrorMessage(error) };
  }
};

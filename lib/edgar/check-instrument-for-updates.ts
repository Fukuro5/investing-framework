import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveInstrumentCik } from "@/lib/edgar/resolve-cik";
import { checkForNewFiling } from "@/lib/edgar/check-for-new-filing";
import { computeFinancialsTrend, type FinancialsTrendVerdict } from "@/lib/edgar/compute-financials-trend";
import { upsertTrendMetric } from "@/lib/edgar/upsert-trend-metric";
import { updateCheckedPointer } from "@/lib/edgar/update-checked-pointer";

export type CheckInstrumentForUpdatesResult = { status: "upToDate" } | { status: "updated"; verdict: FinancialsTrendVerdict };

// The top-level entry point the "check for updates" Server Action calls —
// implements PLANNING.md §1 Phase 3's full manual, per-company,
// new-filing-gated flow: resolve CIK once (cached), ask EDGAR whether
// there's anything new at all, and only do the real fetch/compute work
// (3a's financials trend) if there is.
export const checkInstrumentForUpdates = async (
  instrumentId: string,
  userAgent: string,
  db: PrismaClient = prisma,
): Promise<CheckInstrumentForUpdatesResult> => {
  const cik = await resolveInstrumentCik(instrumentId, userAgent, db);
  const newFilingCheck = await checkForNewFiling({ instrumentId, cik, userAgent, db });

  if (!newFilingCheck.isNew) {
    return { status: "upToDate" };
  }

  const trend = await computeFinancialsTrend(cik, newFilingCheck.filing, userAgent);
  await upsertTrendMetric(instrumentId, trend, db);
  await updateCheckedPointer(instrumentId, newFilingCheck.filing, db);

  return { status: "updated", verdict: trend.verdict };
};

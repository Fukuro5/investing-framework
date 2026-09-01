import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TREND_METRIC_KEY } from "@/lib/edgar/consts";
import { TREND_VERDICT_VALUES, type FinancialsTrendVerdict } from "@/lib/edgar/compute-financials-trend";
import { resolveMetricValue } from "@/lib/metrics/resolve-metric-value";

export interface InstrumentEdgarStatus {
  lastCheckedFilingDate: Date | null;
  verdict: FinancialsTrendVerdict | null;
}

const VERDICT_BY_VALUE = new Map<number, FinancialsTrendVerdict>(
  Object.entries(TREND_VERDICT_VALUES).map(([verdict, value]) => [value, verdict as FinancialsTrendVerdict]),
);

// Read model for the Thesis page's "check for updates" UI (PLANNING.md §1
// Phase 3). Reuses resolveMetricValue so a fresher manual override of
// edgarFinancialsTrend (§6's precedence rule) is reflected here too.
export const getInstrumentEdgarStatus = async (instrumentId: string, db: PrismaClient = prisma): Promise<InstrumentEdgarStatus> => {
  const [instrument, trendMetric] = await Promise.all([
    db.instrument.findUnique({ where: { id: instrumentId }, select: { lastCheckedFilingDate: true } }),
    resolveMetricValue(instrumentId, TREND_METRIC_KEY, db),
  ]);

  return {
    lastCheckedFilingDate: instrument?.lastCheckedFilingDate ?? null,
    verdict: trendMetric ? (VERDICT_BY_VALUE.get(trendMetric.value) ?? null) : null,
  };
};

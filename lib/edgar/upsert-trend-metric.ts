import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TREND_METRIC_KEY } from "@/lib/edgar/consts";
import type { FinancialsTrendResult } from "@/lib/edgar/compute-financials-trend";

// Same upsert shape as lib/market-data/refresh-market-data.ts's refreshMetrics
// — writes into the existing MetricValue table (source: "api") rather than a
// new table (PLANNING.md §1 Phase 3a).
export const upsertTrendMetric = async (instrumentId: string, result: FinancialsTrendResult, db: PrismaClient = prisma) =>
  db.metricValue.upsert({
    where: {
      instrumentId_metricKey_source_asOfDate: {
        instrumentId,
        metricKey: TREND_METRIC_KEY,
        source: "api",
        asOfDate: result.asOfDate,
      },
    },
    update: { value: result.value, fetchedAt: new Date() },
    create: { instrumentId, metricKey: TREND_METRIC_KEY, value: result.value, asOfDate: result.asOfDate, source: "api" },
  });

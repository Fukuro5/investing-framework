import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MetricError } from "@/lib/metrics/errors";

export interface UpsertManualMetricInput {
  instrumentId: string;
  metricKey: string;
  value: number;
  asOfDate: Date;
}

// Manual entries always have source "manual" — see resolveMetricValue for
// how this competes against any "api" row for the same key.
export const upsertManualMetric = async (input: UpsertManualMetricInput, db: PrismaClient = prisma) => {
  const metricKey = input.metricKey.trim();

  if (metricKey.length === 0) {
    throw new MetricError("metricKeyRequired", "Metric key is required");
  }

  return db.metricValue.upsert({
    where: {
      instrumentId_metricKey_source_asOfDate: {
        instrumentId: input.instrumentId,
        metricKey,
        source: "manual",
        asOfDate: input.asOfDate,
      },
    },
    update: { value: input.value, fetchedAt: new Date() },
    create: {
      instrumentId: input.instrumentId,
      metricKey,
      value: input.value,
      asOfDate: input.asOfDate,
      source: "manual",
    },
  });
};

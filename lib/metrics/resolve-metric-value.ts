import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ResolvedMetricValue {
  value: number;
  asOfDate: Date;
  source: string;
  fetchedAt: Date;
}

// Manual entry is gone (PLANNING.md §1 Phase 3) — every MetricValue row is
// now source "api", so this just reads the latest one for this
// instrument+metricKey.
export const resolveMetricValue = async (
  instrumentId: string,
  metricKey: string,
  db: PrismaClient = prisma,
): Promise<ResolvedMetricValue | null> => {
  const [latest] = await db.metricValue.findMany({
    where: { instrumentId, metricKey, source: "api" },
    orderBy: { asOfDate: "desc" },
    take: 1,
  });

  return latest ?? null;
};

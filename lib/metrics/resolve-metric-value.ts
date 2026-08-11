import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ResolvedMetricValue {
  value: number;
  asOfDate: Date;
  source: string;
  fetchedAt: Date;
}

// Manual doesn't automatically win — whichever row (manual or api) for this
// instrument+metricKey has the more recent asOfDate wins, ties broken by
// fetchedAt (PLANNING.md §3/§5/§9). Manual only wins by default when the
// API doesn't supply that metric at all (no api row exists).
export const resolveMetricValue = async (
  instrumentId: string,
  metricKey: string,
  db: PrismaClient = prisma,
): Promise<ResolvedMetricValue | null> => {
  const [latest] = await db.metricValue.findMany({
    where: { instrumentId, metricKey },
    orderBy: [{ asOfDate: "desc" }, { fetchedAt: "desc" }],
    take: 1,
  });

  return latest ?? null;
};

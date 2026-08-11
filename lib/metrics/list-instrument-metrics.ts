import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface InstrumentMetricRow {
  metricKey: string;
  value: number;
  asOfDate: Date;
  source: string;
  fetchedAt: Date;
  // The row resolveMetricValue would currently pick for this metricKey —
  // see that module for the precedence rule.
  isCurrent: boolean;
}

export const listInstrumentMetrics = async (instrumentId: string, db: PrismaClient = prisma): Promise<InstrumentMetricRow[]> => {
  const rows = await db.metricValue.findMany({
    where: { instrumentId },
    orderBy: [{ metricKey: "asc" }, { asOfDate: "desc" }, { fetchedAt: "desc" }],
  });

  const seenMetricKeys = new Set<string>();

  return rows.map((row) => {
    const isCurrent = !seenMetricKeys.has(row.metricKey);
    seenMetricKeys.add(row.metricKey);
    return { ...row, isCurrent };
  });
};

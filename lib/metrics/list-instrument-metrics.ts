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

  // resolveMetricValue only ever reads "api" rows (PLANNING.md §1 Phase 3),
  // so a "manual" row is never current, no matter how recent its asOfDate.
  const seenCurrentMetricKeys = new Set<string>();

  return rows.map((row) => {
    const isCurrent = row.source === "api" && !seenCurrentMetricKeys.has(row.metricKey);
    if (row.source === "api") {
      seenCurrentMetricKeys.add(row.metricKey);
    }
    return { ...row, isCurrent };
  });
};

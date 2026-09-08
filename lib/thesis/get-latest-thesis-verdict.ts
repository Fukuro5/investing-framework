import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isThesisVerdict, type ThesisVerdict } from "@/lib/ai/types";

export interface LatestThesisVerdict {
  verdict: ThesisVerdict;
  explanation: string;
}

// Same resolution shape as resolveMetricValue (lib/metrics/resolve-metric-value.ts):
// latest by asOfDate, ties broken by fetchedAt.
export const getLatestThesisVerdict = async (instrumentId: string, db: PrismaClient = prisma): Promise<LatestThesisVerdict | null> => {
  const [latest] = await db.thesisVerdict.findMany({
    where: { instrumentId },
    orderBy: [{ asOfDate: "desc" }, { fetchedAt: "desc" }],
    take: 1,
  });

  if (!latest || !isThesisVerdict(latest.verdict)) {
    return null;
  }

  return { verdict: latest.verdict, explanation: latest.explanation };
};

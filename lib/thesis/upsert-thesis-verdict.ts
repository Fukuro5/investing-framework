import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ThesisAssessment } from "@/lib/ai/types";
import type { TrackedFiling } from "@/lib/edgar/get-latest-tracked-filing";

// Upserted on (instrumentId, accessionNumber) — mirrors upsertTrendMetric
// (lib/edgar/upsert-trend-metric.ts), but unlike MetricValue this
// accumulates one row per checked filing rather than one per date, giving
// Phase 5's "see why" breakdown a natural history to read from later.
export const upsertThesisVerdict = async (
  instrumentId: string,
  filing: TrackedFiling,
  assessment: ThesisAssessment,
  db: PrismaClient = prisma,
) =>
  db.thesisVerdict.upsert({
    where: { instrumentId_accessionNumber: { instrumentId, accessionNumber: filing.accessionNumber } },
    update: { verdict: assessment.verdict, explanation: assessment.explanation, asOfDate: new Date(filing.filingDate), fetchedAt: new Date() },
    create: {
      instrumentId,
      accessionNumber: filing.accessionNumber,
      verdict: assessment.verdict,
      explanation: assessment.explanation,
      asOfDate: new Date(filing.filingDate),
    },
  });

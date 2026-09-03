import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AiError, type AiErrorCode } from "@/lib/ai/errors";
import { getConfiguredAiProvider } from "@/lib/ai/get-configured-ai-provider";
import type { ThesisVerdict } from "@/lib/ai/types";
import { getFilingText } from "@/lib/edgar/get-filing-text";
import type { TrackedFiling } from "@/lib/edgar/get-latest-tracked-filing";
import { upsertThesisVerdict } from "@/lib/thesis/upsert-thesis-verdict";

export type ThesisCheckResult =
  | { status: "assessed"; verdict: ThesisVerdict; explanation: string }
  | { status: "skippedNoThesis" }
  | { status: "failed"; code: AiErrorCode };

// Runs alongside computeFinancialsTrend inside checkInstrumentForUpdates
// (PLANNING.md §1 Phase 4) once a new filing is confirmed. Never rejects —
// every failure mode (no thesis yet, missing API key, request failure,
// malformed response) becomes a ThesisCheckResult value, so a failed/skipped
// AI check never blocks the financials trend check or the checked-pointer
// update that follow it in the orchestrator.
export const assessThesisAgainstFiling = async (
  instrumentId: string,
  cik: string,
  filing: TrackedFiling,
  userAgent: string,
  db: PrismaClient = prisma,
): Promise<ThesisCheckResult> => {
  const thesis = await db.thesis.findUnique({ where: { instrumentId } });

  if (!thesis || thesis.content.trim() === "") {
    return { status: "skippedNoThesis" };
  }

  try {
    const filingText = await getFilingText(cik, filing, userAgent);
    const provider = getConfiguredAiProvider();
    const assessment = await provider.assessThesis({ thesisContent: thesis.content, filingText });
    await upsertThesisVerdict(instrumentId, filing, assessment, db);

    return { status: "assessed", verdict: assessment.verdict, explanation: assessment.explanation };
  } catch (error) {
    return { status: "failed", code: error instanceof AiError ? error.code : "requestFailed" };
  }
};

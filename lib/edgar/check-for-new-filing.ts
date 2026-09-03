import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLatestTrackedFiling, type TrackedFiling } from "@/lib/edgar/get-latest-tracked-filing";
import { EdgarError } from "@/lib/edgar/errors";

export type NewFilingCheck = { isNew: true; filing: TrackedFiling } | { isNew: false; filing: null };

interface CheckForNewFilingParams {
  instrumentId: string;
  cik: string;
  userAgent: string;
  db?: PrismaClient;
}

// The cheap "is there anything new at all" step from PLANNING.md §1 Phase
// 3's trigger model — only compares accession numbers, no financials/text
// fetch happens here.
export const checkForNewFiling = async ({
  instrumentId,
  cik,
  userAgent,
  db = prisma,
}: CheckForNewFilingParams): Promise<NewFilingCheck> => {
  const instrument = await db.instrument.findUnique({ where: { id: instrumentId } });

  if (!instrument) {
    throw new EdgarError("instrumentNotFound", `Instrument "${instrumentId}" not found`);
  }

  const filing = await getLatestTrackedFiling(cik, userAgent);

  if (!filing) {
    throw new EdgarError("noTrackedFilingFound", `No 10-K/10-Q/20-F filing found for CIK "${cik}"`);
  }

  if (filing.accessionNumber === instrument.lastCheckedAccessionNumber) {
    return { isNew: false, filing: null };
  }

  return { isNew: true, filing };
};

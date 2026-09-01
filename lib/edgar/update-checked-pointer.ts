import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TrackedFiling } from "@/lib/edgar/get-latest-tracked-filing";

// Persists the small pointer the trigger model's "is there anything new"
// check compares against next time (PLANNING.md §1 Phase 3).
export const updateCheckedPointer = async (instrumentId: string, filing: TrackedFiling, db: PrismaClient = prisma) =>
  db.instrument.update({
    where: { id: instrumentId },
    data: { lastCheckedFilingDate: new Date(filing.filingDate), lastCheckedAccessionNumber: filing.accessionNumber },
  });

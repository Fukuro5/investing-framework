"use server";

import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ingestStatement } from "@/lib/import/ingest";
import { parseFreedomFinanceStatement } from "@/lib/import/parsers/freedom-finance";
import type { ParsedStatement } from "@/lib/import/types";

export interface ImportStatementState {
  status: "idle" | "success" | "no-new-transactions" | "error";
  transactionCount?: number;
  positionCount?: number;
  errorKey?: "invalidFile" | "genericImportError";
}

const INVALID_FILE_STATE: ImportStatementState = { status: "error", errorKey: "invalidFile" };

// `db` is only ever passed explicitly in tests — bound as a form action via
// useActionState, React always calls this with exactly (previousState,
// formData), so it defaults to the app's shared Prisma client in production.
export const importStatement = async (
  _previousState: ImportStatementState,
  formData: FormData,
  db: PrismaClient = prisma,
): Promise<ImportStatementState> => {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return INVALID_FILE_STATE;
  }

  let statement: ParsedStatement;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    statement = parseFreedomFinanceStatement(buffer);
  } catch {
    return INVALID_FILE_STATE;
  }

  try {
    const result = await ingestStatement(
      {
        statement,
        fileName: file.name,
        fileType: file.type || "application/json",
      },
      db,
    );

    if (result.insertedTransactionCount === 0 && result.skippedTransactionCount > 0) {
      return { status: "no-new-transactions" };
    }

    return {
      status: "success",
      transactionCount: result.insertedTransactionCount,
      positionCount: result.positionSnapshotCount,
    };
  } catch {
    return { status: "error", errorKey: "genericImportError" };
  }
};

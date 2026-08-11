import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findOrCreateAccount } from "@/lib/import/ingest/find-or-create-account";
import { insertNewTransactions } from "@/lib/import/ingest/insert-transactions";
import { resolveInstruments } from "@/lib/import/ingest/resolve-instruments";
import { upsertPositionSnapshots } from "@/lib/import/ingest/upsert-position-snapshots";
import type { ParsedStatement } from "@/lib/import/types";

export interface IngestStatementInput {
  statement: ParsedStatement;
  fileName: string;
  fileType: string;
}

export interface IngestStatementResult {
  importBatchId: string;
  insertedTransactionCount: number;
  skippedTransactionCount: number;
  positionSnapshotCount: number;
}

// The one format-agnostic ingestion path every StatementParser feeds into
// (PLANNING.md §4) — validation/dedup/storage here never changes when a
// new broker/format parser is added. `db` defaults to the app's shared
// Prisma client and is only overridden in tests, which run this against a
// real per-test SQLite database instead of mocking Prisma calls.
export const ingestStatement = (
  { statement, fileName, fileType }: IngestStatementInput,
  db: PrismaClient = prisma,
): Promise<IngestStatementResult> =>
  db.$transaction(async (tx) => {
    const account = await findOrCreateAccount(tx, statement.broker, statement.account);

    const importBatch = await tx.importBatch.create({
      data: { accountId: account.id, fileName, fileType, status: "completed" },
    });

    const instrumentRefs = [
      ...statement.transactions.flatMap((transaction) => (transaction.instrument ? [transaction.instrument] : [])),
      ...statement.positionSnapshots.map((snapshot) => snapshot.instrument),
    ];
    const instrumentIdByTicker = await resolveInstruments(tx, instrumentRefs);

    const insertedTransactionCount = await insertNewTransactions(
      tx,
      account.id,
      importBatch.id,
      statement.transactions,
      instrumentIdByTicker,
    );
    const positionSnapshotCount = await upsertPositionSnapshots(
      tx,
      account.id,
      importBatch.id,
      statement.positionSnapshots,
      instrumentIdByTicker,
    );

    return {
      importBatchId: importBatch.id,
      insertedTransactionCount,
      skippedTransactionCount: statement.transactions.length - insertedTransactionCount,
      positionSnapshotCount,
    };
  });

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ingestStatement, type IngestStatementInput } from "@/lib/import/ingest";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import type { ParsedStatement } from "@/lib/import/types";

const buildStatement = (overrides: Partial<ParsedStatement> = {}): ParsedStatement => ({
  broker: "freedom-finance",
  account: { label: "Freedom Finance 000", baseCurrency: "USD" },
  period: { start: new Date("2026-06-30T23:59:59.000Z"), end: new Date("2026-07-31T23:59:59.000Z") },
  transactions: [
    {
      brokerRef: "tx-1",
      type: "dividend",
      date: new Date("2026-07-14T11:42:25.000Z"),
      instrument: {
        ticker: "TSM.US",
        isin: "US8740391003",
        name: "Taiwan Semiconductor",
        assetType: "unknown",
        currency: "USD",
        exchange: null,
      },
      quantity: 5,
      price: 0.939325,
      fees: 0,
      currency: "USD",
    },
  ],
  positionSnapshots: [
    {
      instrument: {
        ticker: "TSM.US",
        isin: "US8740391003",
        name: "Taiwan Semiconductor",
        assetType: "unknown",
        currency: "USD",
        exchange: null,
      },
      asOfDate: new Date("2026-07-31T23:59:59.000Z"),
      quantity: 5,
      avgCostPrice: 369.1612,
      marketPrice: 404.25,
      marketValue: 2021.25,
      unrealizedPnl: 175.44,
      currency: "USD",
    },
  ],
  ...overrides,
});

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(async () => {
  await testDb.cleanup();
});

const ingest = (input: IngestStatementInput) => ingestStatement(input, testDb.prisma);

describe("ingestStatement", () => {
  it("creates broker, account, instrument, transaction, and position snapshot rows", async () => {
    const result = await ingest({
      statement: buildStatement(),
      fileName: "statement.json",
      fileType: "application/json",
    });

    expect(result.insertedTransactionCount).toBe(1);
    expect(result.skippedTransactionCount).toBe(0);
    expect(result.positionSnapshotCount).toBe(1);

    const account = await testDb.prisma.account.findFirstOrThrow({ include: { broker: true } });
    expect(account.broker.name).toBe("freedom-finance");
    expect(account.label).toBe("Freedom Finance 000");

    const transactions = await testDb.prisma.transaction.findMany();
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ brokerRef: "tx-1", type: "dividend" });

    const snapshots = await testDb.prisma.positionSnapshot.findMany();
    expect(snapshots).toHaveLength(1);
  });

  it("does not duplicate transactions when the same statement is re-ingested", async () => {
    const statement = buildStatement();

    await ingest({ statement, fileName: "statement.json", fileType: "application/json" });
    const second = await ingest({ statement, fileName: "statement.json", fileType: "application/json" });

    expect(second.insertedTransactionCount).toBe(0);
    expect(second.skippedTransactionCount).toBe(1);

    const transactions = await testDb.prisma.transaction.findMany();
    expect(transactions).toHaveLength(1);
  });

  it("only inserts the new transaction from a partially-overlapping re-import", async () => {
    await ingest({ statement: buildStatement(), fileName: "statement.json", fileType: "application/json" });

    const overlapping = buildStatement({
      transactions: [
        ...buildStatement().transactions,
        {
          brokerRef: "tx-2",
          type: "fee",
          date: new Date("2026-08-01T00:00:00.000Z"),
          instrument: null,
          quantity: 1,
          price: 5,
          fees: null,
          currency: "USD",
        },
      ],
    });
    const result = await ingest({
      statement: overlapping,
      fileName: "statement-2.json",
      fileType: "application/json",
    });

    expect(result.insertedTransactionCount).toBe(1);
    expect(result.skippedTransactionCount).toBe(1);

    const transactions = await testDb.prisma.transaction.findMany({ orderBy: { brokerRef: "asc" } });
    expect(transactions.map((transaction) => transaction.brokerRef)).toEqual(["tx-1", "tx-2"]);
  });

  it("upserts (refreshes) a position snapshot instead of duplicating it on re-import", async () => {
    await ingest({ statement: buildStatement(), fileName: "statement.json", fileType: "application/json" });

    const revised = buildStatement({
      positionSnapshots: [{ ...buildStatement().positionSnapshots[0], marketPrice: 410, marketValue: 2050 }],
    });
    await ingest({ statement: revised, fileName: "statement.json", fileType: "application/json" });

    const snapshots = await testDb.prisma.positionSnapshot.findMany();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].marketPrice).toBe(410);
  });
});

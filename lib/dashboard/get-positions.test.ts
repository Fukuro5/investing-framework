import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPositions } from "@/lib/dashboard/get-positions";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(async () => {
  await testDb.cleanup();
});

const seedAccount = async () => {
  const broker = await testDb.prisma.broker.create({ data: { name: "freedom-finance" } });
  const account = await testDb.prisma.account.create({
    data: { brokerId: broker.id, label: "Freedom Finance 000", baseCurrency: "USD" },
  });
  const importBatch = await testDb.prisma.importBatch.create({
    data: { accountId: account.id, fileName: "statement.json", fileType: "application/json", status: "completed" },
  });

  return { account, importBatch };
};

const seedInstrument = (ticker: string, currency = "USD") =>
  testDb.prisma.instrument.create({
    data: { ticker, name: ticker, assetType: "unknown", currency },
  });

describe("getPositions", () => {
  it("returns a position sourced from the latest PositionSnapshot", async () => {
    const { account, importBatch } = await seedAccount();
    const instrument = await seedInstrument("TSM.US");

    await testDb.prisma.positionSnapshot.create({
      data: {
        accountId: account.id,
        instrumentId: instrument.id,
        importBatchId: importBatch.id,
        asOfDate: new Date("2026-07-31"),
        quantity: 5,
        avgCostPrice: 369.16,
        marketPrice: 404.25,
        marketValue: 2021.25,
        unrealizedPnl: 175.44,
        currency: "USD",
      },
    });

    const positions = await getPositions(testDb.prisma);

    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({
      accountLabel: "Freedom Finance 000",
      ticker: "TSM.US",
      quantity: 5,
      marketPrice: 404.25,
      marketValue: 2021.25,
      source: "snapshot",
    });
  });

  it("prefers the most recent of multiple snapshots for the same instrument", async () => {
    const { account, importBatch } = await seedAccount();
    const instrument = await seedInstrument("TSM.US");
    const base = {
      accountId: account.id,
      instrumentId: instrument.id,
      importBatchId: importBatch.id,
      quantity: 5,
      avgCostPrice: 369.16,
      currency: "USD",
    };

    await testDb.prisma.positionSnapshot.create({
      data: { ...base, asOfDate: new Date("2026-06-30"), marketPrice: 477.57, marketValue: 2387.85, unrealizedPnl: 542.04 },
    });
    await testDb.prisma.positionSnapshot.create({
      data: { ...base, asOfDate: new Date("2026-07-31"), marketPrice: 404.25, marketValue: 2021.25, unrealizedPnl: 175.44 },
    });

    const positions = await getPositions(testDb.prisma);

    expect(positions).toHaveLength(1);
    expect(positions[0].marketPrice).toBe(404.25);
  });

  it("excludes a snapshot with zero quantity (a closed position)", async () => {
    const { account, importBatch } = await seedAccount();
    const instrument = await seedInstrument("TSM.US");

    await testDb.prisma.positionSnapshot.create({
      data: {
        accountId: account.id,
        instrumentId: instrument.id,
        importBatchId: importBatch.id,
        asOfDate: new Date("2026-07-31"),
        quantity: 0,
        avgCostPrice: 0,
        marketPrice: 404.25,
        marketValue: 0,
        unrealizedPnl: 0,
        currency: "USD",
      },
    });

    expect(await getPositions(testDb.prisma)).toEqual([]);
  });

  it("falls back to deriving from transactions when no snapshot exists, with a null price until Phase 3", async () => {
    const { account, importBatch } = await seedAccount();
    const instrument = await seedInstrument("O.US");

    await testDb.prisma.transaction.create({
      data: {
        accountId: account.id,
        instrumentId: instrument.id,
        importBatchId: importBatch.id,
        type: "buy",
        date: new Date("2026-01-01"),
        quantity: 10,
        price: 55,
        currency: "USD",
        brokerRef: "tx-1",
      },
    });

    const positions = await getPositions(testDb.prisma);

    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({
      ticker: "O.US",
      quantity: 10,
      avgCostPrice: 55,
      marketPrice: null,
      marketValue: null,
      unrealizedPnl: null,
      source: "derived",
    });
  });

  it("computes market value/unrealized P&L for a derived position once a PriceSnapshot exists", async () => {
    const { account, importBatch } = await seedAccount();
    const instrument = await seedInstrument("O.US");

    await testDb.prisma.transaction.create({
      data: {
        accountId: account.id,
        instrumentId: instrument.id,
        importBatchId: importBatch.id,
        type: "buy",
        date: new Date("2026-01-01"),
        quantity: 10,
        price: 55,
        currency: "USD",
        brokerRef: "tx-1",
      },
    });
    await testDb.prisma.priceSnapshot.create({
      data: { instrumentId: instrument.id, date: new Date("2026-02-01"), price: 60 },
    });

    const [position] = await getPositions(testDb.prisma);

    expect(position).toMatchObject({ marketPrice: 60, marketValue: 600, unrealizedPnl: 50 });
  });

  it("excludes a fully-sold derived position (net quantity zero)", async () => {
    const { account, importBatch } = await seedAccount();
    const instrument = await seedInstrument("O.US");
    const base = { accountId: account.id, instrumentId: instrument.id, importBatchId: importBatch.id, currency: "USD" };

    await testDb.prisma.transaction.create({
      data: { ...base, type: "buy", date: new Date("2026-01-01"), quantity: 10, price: 55, brokerRef: "tx-1" },
    });
    await testDb.prisma.transaction.create({
      data: { ...base, type: "sell", date: new Date("2026-02-01"), quantity: 10, price: 60, brokerRef: "tx-2" },
    });

    expect(await getPositions(testDb.prisma)).toEqual([]);
  });

  it("prefers the snapshot over deriving from transactions when both exist for the same position", async () => {
    const { account, importBatch } = await seedAccount();
    const instrument = await seedInstrument("TSM.US");

    await testDb.prisma.transaction.create({
      data: {
        accountId: account.id,
        instrumentId: instrument.id,
        importBatchId: importBatch.id,
        type: "buy",
        date: new Date("2026-01-01"),
        quantity: 999,
        price: 1,
        currency: "USD",
        brokerRef: "tx-1",
      },
    });
    await testDb.prisma.positionSnapshot.create({
      data: {
        accountId: account.id,
        instrumentId: instrument.id,
        importBatchId: importBatch.id,
        asOfDate: new Date("2026-07-31"),
        quantity: 5,
        avgCostPrice: 369.16,
        marketPrice: 404.25,
        marketValue: 2021.25,
        unrealizedPnl: 175.44,
        currency: "USD",
      },
    });

    const positions = await getPositions(testDb.prisma);

    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({ quantity: 5, source: "snapshot" });
  });
});

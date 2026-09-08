import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import { checkForNewFiling } from "@/lib/edgar/check-for-new-filing";
import { EdgarError } from "@/lib/edgar/errors";

const jsonResponse = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

const submissionsWith = (accessionNumber: string) =>
  jsonResponse({
    filings: {
      recent: { form: ["10-Q"], filingDate: ["2026-05-01"], accessionNumber: [accessionNumber], primaryDocument: ["b.htm"] },
    },
  });

describe("checkForNewFiling", () => {
  let testDb: TestDb;
  const fetchMock = vi.fn();

  beforeEach(() => {
    testDb = createTestDb();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    await testDb.cleanup();
  });

  it("throws when the instrument doesn't exist", async () => {
    await expect(
      checkForNewFiling({ instrumentId: "missing-id", cik: "0000320193", userAgent: "ua", db: testDb.prisma }),
    ).rejects.toThrow(EdgarError);
  });

  it("throws when EDGAR has no tracked filing for this CIK", async () => {
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "AAPL.US", name: "Apple", assetType: "equity", currency: "USD" },
    });
    fetchMock.mockReturnValueOnce(
      jsonResponse({ filings: { recent: { form: [], filingDate: [], accessionNumber: [], primaryDocument: [] } } }),
    );

    await expect(
      checkForNewFiling({ instrumentId: instrument.id, cik: "0000320193", userAgent: "ua", db: testDb.prisma }),
    ).rejects.toThrow(EdgarError);
  });

  it("reports no new filing when the accession number matches the stored pointer", async () => {
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "AAPL.US", name: "Apple", assetType: "equity", currency: "USD", lastCheckedAccessionNumber: "0001-q2" },
    });
    fetchMock.mockReturnValueOnce(submissionsWith("0001-q2"));

    const result = await checkForNewFiling({ instrumentId: instrument.id, cik: "0000320193", userAgent: "ua", db: testDb.prisma });

    expect(result).toEqual({ isNew: false, filing: null });
  });

  it("reports a new filing when the accession number differs from the stored pointer", async () => {
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "AAPL.US", name: "Apple", assetType: "equity", currency: "USD", lastCheckedAccessionNumber: "0001-q1" },
    });
    fetchMock.mockReturnValueOnce(submissionsWith("0001-q2"));

    const result = await checkForNewFiling({ instrumentId: instrument.id, cik: "0000320193", userAgent: "ua", db: testDb.prisma });

    expect(result.isNew).toBe(true);
    expect(result.filing?.accessionNumber).toBe("0001-q2");
  });

  it("reports a new filing when nothing has ever been checked", async () => {
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "AAPL.US", name: "Apple", assetType: "equity", currency: "USD" },
    });
    fetchMock.mockReturnValueOnce(submissionsWith("0001-q2"));

    const result = await checkForNewFiling({ instrumentId: instrument.id, cik: "0000320193", userAgent: "ua", db: testDb.prisma });

    expect(result.isNew).toBe(true);
  });
});

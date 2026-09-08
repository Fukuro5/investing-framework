import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import { EdgarError } from "@/lib/edgar/errors";
import { resolveInstrumentCik, toEdgarSymbol } from "@/lib/edgar/resolve-cik";

const jsonResponse = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

const TICKERS_RESPONSE = {
  "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
  "1": { cik_str: 1318605, ticker: "TSLA", title: "Tesla, Inc." },
};

describe("toEdgarSymbol", () => {
  it("strips the Freedom Finance .US suffix", () => {
    expect(toEdgarSymbol("AAPL.US")).toBe("AAPL");
  });

  it("passes through a ticker with no suffix unchanged", () => {
    expect(toEdgarSymbol("AAPL")).toBe("AAPL");
  });
});

describe("resolveInstrumentCik", () => {
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
    await expect(resolveInstrumentCik("missing-id", "ua", testDb.prisma)).rejects.toThrow(EdgarError);
  });

  it("returns the cached edgarCik without calling fetch", async () => {
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "AAPL.US", name: "Apple", assetType: "equity", currency: "USD", edgarCik: "0000320193" },
    });

    const cik = await resolveInstrumentCik(instrument.id, "ua", testDb.prisma);

    expect(cik).toBe("0000320193");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("looks up, zero-pads, and caches the CIK when not already resolved", async () => {
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "AAPL.US", name: "Apple", assetType: "equity", currency: "USD" },
    });
    fetchMock.mockReturnValueOnce(jsonResponse(TICKERS_RESPONSE));

    const cik = await resolveInstrumentCik(instrument.id, "ua", testDb.prisma);

    expect(cik).toBe("0000320193");
    const updated = await testDb.prisma.instrument.findUniqueOrThrow({ where: { id: instrument.id } });
    expect(updated.edgarCik).toBe("0000320193");
  });

  it("throws EdgarError when no ticker match is found", async () => {
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "NOPE.US", name: "Nobody", assetType: "equity", currency: "USD" },
    });
    fetchMock.mockReturnValueOnce(jsonResponse(TICKERS_RESPONSE));

    await expect(resolveInstrumentCik(instrument.id, "ua", testDb.prisma)).rejects.toThrow(EdgarError);
  });
});

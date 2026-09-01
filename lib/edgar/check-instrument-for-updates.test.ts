import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import { checkInstrumentForUpdates } from "@/lib/edgar/check-instrument-for-updates";
import { EdgarError } from "@/lib/edgar/errors";

const FIXTURES_DIR = join(process.cwd(), "fixtures/edgar-samples");
const readFixture = (name: string) => JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf-8"));

const REVENUE_FIXTURE = readFixture("revenue-sample.json");
const NET_INCOME_FIXTURE = readFixture("net-income-loss-sample.json");
const ACCN = "0000320193-26-000020";

const jsonResponse = (body: unknown, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);

const TICKERS_RESPONSE = { "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." } };
const SUBMISSIONS_RESPONSE = {
  filings: { recent: { form: ["10-Q"], filingDate: ["2026-07-31"], accessionNumber: [ACCN], primaryDocument: ["aapl-10q.htm"] } },
};

// End-to-end (network mocked, real sqlite DB): mocks every EDGAR endpoint
// the orchestrator touches, keyed by URL so Promise.all's concurrent
// fetches inside computeFinancialsTrend resolve correctly regardless of call
// order. Any other companyconcept request (the optional line items beyond
// revenue/net income) 404s, same as a company that doesn't tag that concept
// — computeFinancialsTrend treats that as "skip", not an error.
const mockEdgarEndpoints = () => {
  vi.mocked(fetch).mockImplementation((input) => {
    const url = String(input);
    if (url.endsWith("/files/company_tickers.json")) return jsonResponse(TICKERS_RESPONSE);
    if (url.includes("/submissions/CIK")) return jsonResponse(SUBMISSIONS_RESPONSE);
    if (url.endsWith("/RevenueFromContractWithCustomerExcludingAssessedTax.json")) return jsonResponse(REVENUE_FIXTURE);
    if (url.endsWith("/NetIncomeLoss.json")) return jsonResponse(NET_INCOME_FIXTURE);
    if (url.includes("/api/xbrl/companyconcept/")) return jsonResponse({}, false, 404);
    throw new Error(`Unexpected EDGAR request: ${url}`);
  });
};

describe("checkInstrumentForUpdates", () => {
  let testDb: TestDb;
  let instrumentId: string;

  beforeEach(async () => {
    testDb = createTestDb();
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "AAPL.US", name: "Apple", assetType: "equity", currency: "USD" },
    });
    instrumentId = instrument.id;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await testDb.cleanup();
  });

  it("resolves CIK, fetches the filing, writes a verdict, and updates the pointer on first check", async () => {
    mockEdgarEndpoints();

    const result = await checkInstrumentForUpdates(instrumentId, "ua", testDb.prisma);

    expect(result).toEqual({ status: "updated", verdict: "improving" });

    const instrument = await testDb.prisma.instrument.findUniqueOrThrow({ where: { id: instrumentId } });
    expect(instrument.edgarCik).toBe("0000320193");
    expect(instrument.lastCheckedAccessionNumber).toBe(ACCN);

    const metrics = await testDb.prisma.metricValue.findMany({ where: { instrumentId, metricKey: "edgarFinancialsTrend" } });
    expect(metrics).toHaveLength(1);
    expect(metrics[0].value).toBe(1);
  });

  it("reports up to date and skips financials work when the accession number hasn't changed", async () => {
    await testDb.prisma.instrument.update({
      where: { id: instrumentId },
      data: { edgarCik: "0000320193", lastCheckedAccessionNumber: ACCN },
    });
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/submissions/CIK")) return jsonResponse(SUBMISSIONS_RESPONSE);
      throw new Error(`Unexpected EDGAR request during an up-to-date check: ${url}`);
    });

    const result = await checkInstrumentForUpdates(instrumentId, "ua", testDb.prisma);

    expect(result).toEqual({ status: "upToDate" });
    const metrics = await testDb.prisma.metricValue.findMany({ where: { instrumentId } });
    expect(metrics).toHaveLength(0);
  });

  it("propagates a cikNotFound error when the ticker has no SEC match", async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/files/company_tickers.json")) return jsonResponse({});
      throw new Error(`Unexpected EDGAR request: ${url}`);
    });

    await expect(checkInstrumentForUpdates(instrumentId, "ua", testDb.prisma)).rejects.toThrow(EdgarError);
  });
});

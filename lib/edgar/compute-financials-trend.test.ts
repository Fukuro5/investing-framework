import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeFinancialsTrend, TREND_VERDICT_VALUES } from "@/lib/edgar/compute-financials-trend";
import { EdgarError } from "@/lib/edgar/errors";
import type { TrackedFiling } from "@/lib/edgar/get-latest-tracked-filing";

const FIXTURES_DIR = join(process.cwd(), "fixtures/edgar-samples");
const readFixture = (name: string) => JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf-8"));

const ACCN = "0000320193-26-000020";
const FILING: TrackedFiling = { form: "10-Q", filingDate: "2026-07-31", accessionNumber: ACCN, primaryDocument: "x.htm" };

const jsonResponse = (body: unknown, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);

const durationConcept = (current: number, prior: number) => ({
  units: {
    USD: [
      { start: "2026-03-29", end: "2026-06-27", val: current, accn: ACCN, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" },
      { start: "2025-03-30", end: "2025-06-28", val: prior, accn: ACCN, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" },
    ],
  },
});

const instantConcept = (current: number, prior: number) => ({
  units: {
    USD: [
      { end: "2026-06-27", val: current, accn: ACCN, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" },
      { end: "2025-06-28", val: prior, accn: ACCN, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" },
    ],
  },
});

// Keyed by "taxonomy/tag" (the URL suffix fetchConceptFacts builds). Any
// path not listed here 404s, matching a company that doesn't tag that
// concept — computeFinancialsTrend must treat that as "skip this optional
// line item", not a hard failure (PLANNING.md §1 Phase 3a).
const mockEdgarConcepts = (responsesByPath: Record<string, unknown>) => {
  vi.mocked(fetch).mockImplementation((input) => {
    const url = String(input);
    const entry = Object.entries(responsesByPath).find(([path]) => url.endsWith(`/${path}.json`));
    return entry ? jsonResponse(entry[1]) : jsonResponse({}, false, 404);
  });
};

describe("computeFinancialsTrend", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns improving when every resolvable line item agrees, including the inverted debt-to-equity ratio", async () => {
    mockEdgarConcepts({
      "us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax": durationConcept(120, 100),
      "us-gaap/NetIncomeLoss": durationConcept(120, 100),
      "us-gaap/OperatingIncomeLoss": durationConcept(120, 100),
      "us-gaap/GrossProfit": durationConcept(120, 100),
      "us-gaap/EarningsPerShareDiluted": durationConcept(1.2, 1.0),
      "us-gaap/NetCashProvidedByUsedInOperatingActivities": durationConcept(240, 200),
      "us-gaap/PaymentsToAcquirePropertyPlantAndEquipment": durationConcept(50, 50),
      "us-gaap/Liabilities": instantConcept(400, 500), // leverage falling → improving after inversion
      "us-gaap/StockholdersEquity": instantConcept(500, 500),
    });

    const result = await computeFinancialsTrend("0000320193", FILING, "ua");

    expect(result.verdict).toBe("improving");
    expect(result.value).toBe(TREND_VERDICT_VALUES.improving);
    expect(result.asOfDate).toEqual(new Date("2026-06-27"));
  });

  it("still resolves a verdict from revenue/net income alone when a company tags none of the optional line items", async () => {
    mockEdgarConcepts({
      "us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax": durationConcept(120, 100),
      "us-gaap/NetIncomeLoss": durationConcept(120, 100),
    });

    const result = await computeFinancialsTrend("0000320193", FILING, "ua");

    expect(result.verdict).toBe("improving");
  });

  it("throws financialsUnavailable when revenue can't be resolved, even if other line items can", async () => {
    mockEdgarConcepts({ "us-gaap/NetIncomeLoss": durationConcept(120, 100) });

    await expect(computeFinancialsTrend("0000320193", FILING, "ua")).rejects.toThrow(EdgarError);
  });

  it("throws financialsUnavailable when net income can't be resolved", async () => {
    mockEdgarConcepts({ "us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax": durationConcept(120, 100) });

    await expect(computeFinancialsTrend("0000320193", FILING, "ua")).rejects.toThrow(EdgarError);
  });

  it("uses majority vote: more deteriorating than improving line items wins", async () => {
    mockEdgarConcepts({
      "us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax": durationConcept(120, 100), // improving
      "us-gaap/NetIncomeLoss": durationConcept(80, 100), // deteriorating
      "us-gaap/OperatingIncomeLoss": durationConcept(80, 100), // deteriorating
    });

    const result = await computeFinancialsTrend("0000320193", FILING, "ua");

    expect(result.verdict).toBe("deteriorating");
  });

  it("resolves to flat on a tie between improving and deteriorating line items", async () => {
    mockEdgarConcepts({
      "us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax": durationConcept(120, 100), // improving
      "us-gaap/NetIncomeLoss": durationConcept(80, 100), // deteriorating
    });

    const result = await computeFinancialsTrend("0000320193", FILING, "ua");

    expect(result.verdict).toBe("flat");
  });

  it("lets a rising debt-to-equity ratio alone tip an otherwise-flat verdict to deteriorating", async () => {
    mockEdgarConcepts({
      "us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax": durationConcept(101, 100), // flat (<5% move)
      "us-gaap/NetIncomeLoss": durationConcept(101, 100), // flat
      "us-gaap/Liabilities": instantConcept(600, 500), // leverage rising → deteriorating after inversion
      "us-gaap/StockholdersEquity": instantConcept(500, 500),
    });

    const result = await computeFinancialsTrend("0000320193", FILING, "ua");

    expect(result.verdict).toBe("deteriorating");
  });

  it("falls back to the ifrs-full taxonomy and cross-accession comparatives for a 20-F filer (real TSMC data)", async () => {
    const revenueFixture = readFixture("tsm-ifrs-revenue-sample.json");
    const profitLossFixture = readFixture("tsm-ifrs-profit-loss-sample.json");
    mockEdgarConcepts({ "ifrs-full/Revenue": revenueFixture, "ifrs-full/ProfitLoss": profitLossFixture });
    const tsmFiling: TrackedFiling = { form: "20-F", filingDate: "2025-04-17", accessionNumber: "0001193125-25-083423", primaryDocument: "x.htm" };

    const result = await computeFinancialsTrend("0001046179", tsmFiling, "ua");

    expect(result.verdict).toBe("improving");
    expect(result.asOfDate).toEqual(new Date("2024-12-31"));
  });
});

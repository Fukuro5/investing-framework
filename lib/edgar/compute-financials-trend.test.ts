import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeFinancialsTrend, findYoyPeriodPair, TREND_VERDICT_VALUES } from "@/lib/edgar/compute-financials-trend";
import { EdgarError } from "@/lib/edgar/errors";
import type { TrackedFiling } from "@/lib/edgar/get-latest-tracked-filing";

const FIXTURES_DIR = join(process.cwd(), "fixtures/edgar-samples");
const readFixture = (name: string) => JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf-8"));

// Real Apple company-concept samples (fetched from data.sec.gov) — both
// line items agree on the same accession number, a 10-Q where revenue and
// net income both grew YoY ("improving").
const REVENUE_FIXTURE = readFixture("revenue-sample.json");
const NET_INCOME_FIXTURE = readFixture("net-income-loss-sample.json");
const IMPROVING_ACCN = "0000320193-26-000020";

const jsonResponse = (body: unknown, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);

const IMPROVING_FILING: TrackedFiling = { form: "10-Q", filingDate: "2026-07-31", accessionNumber: IMPROVING_ACCN, primaryDocument: "x.htm" };

// computeFinancialsTrend fetches revenue and net income concurrently
// (Promise.all), so fetch calls interleave — tests key mock responses off
// the requested URL rather than call order.
const mockEdgarConceptsByTag = (responsesByTag: Record<string, unknown>) => {
  vi.mocked(fetch).mockImplementation((input) => {
    const url = String(input);
    const [tag, response] = Object.entries(responsesByTag).find(([candidateTag]) => url.endsWith(`/${candidateTag}.json`)) ?? [];
    if (!tag) {
      throw new Error(`Unexpected EDGAR request: ${url}`);
    }
    return jsonResponse(response);
  });
};

describe("findYoyPeriodPair", () => {
  const accn = "0001-q2";

  it("pairs the current single-quarter fact with its prior-year comparative quarter", () => {
    const facts = [
      { start: "2025-09-28", end: "2026-06-27", val: 300, accn, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" }, // YTD current
      { start: "2026-03-29", end: "2026-06-27", val: 100, accn, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" }, // Q current
      { start: "2024-09-29", end: "2025-06-28", val: 280, accn, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" }, // YTD prior
      { start: "2025-03-30", end: "2025-06-28", val: 90, accn, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" }, // Q prior
    ];

    const pair = findYoyPeriodPair(facts, accn);

    expect(pair?.current.val).toBe(100);
    expect(pair?.prior.val).toBe(90);
  });

  it("returns null when no facts match the accession number", () => {
    expect(findYoyPeriodPair([], accn)).toBeNull();
  });

  it("returns null when there's no comparable prior-year period (e.g. an IPO-year filing)", () => {
    const facts = [{ start: "2025-09-28", end: "2026-06-27", val: 300, accn, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" }];

    expect(findYoyPeriodPair(facts, accn)).toBeNull();
  });
});

describe("computeFinancialsTrend", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an improving verdict when real revenue and net income data both grew YoY", async () => {
    mockEdgarConceptsByTag({
      RevenueFromContractWithCustomerExcludingAssessedTax: REVENUE_FIXTURE,
      NetIncomeLoss: NET_INCOME_FIXTURE,
    });

    const result = await computeFinancialsTrend("0000320193", IMPROVING_FILING, "ua");

    expect(result.verdict).toBe("improving");
    expect(result.value).toBe(TREND_VERDICT_VALUES.improving);
    expect(result.asOfDate).toEqual(new Date("2026-06-27"));
  });

  it("falls back to the next revenue tag candidate when the first 404s", async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/RevenueFromContractWithCustomerExcludingAssessedTax.json")) {
        return jsonResponse({}, false, 404);
      }
      if (url.endsWith("/Revenues.json")) {
        return jsonResponse(REVENUE_FIXTURE);
      }
      if (url.endsWith("/NetIncomeLoss.json")) {
        return jsonResponse(NET_INCOME_FIXTURE);
      }
      throw new Error(`Unexpected EDGAR request: ${url}`);
    });

    const result = await computeFinancialsTrend("0000320193", IMPROVING_FILING, "ua");

    expect(result.verdict).toBe("improving");
  });

  it("returns a deteriorating verdict when both line items shrank YoY past the threshold", async () => {
    const shrinking = {
      units: {
        USD: [
          { start: "2026-03-29", end: "2026-06-27", val: 80, accn: IMPROVING_ACCN, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" },
          { start: "2025-03-30", end: "2025-06-28", val: 100, accn: IMPROVING_ACCN, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" },
        ],
      },
    };
    mockEdgarConceptsByTag({ RevenueFromContractWithCustomerExcludingAssessedTax: shrinking, NetIncomeLoss: shrinking });

    const result = await computeFinancialsTrend("0000320193", IMPROVING_FILING, "ua");

    expect(result.verdict).toBe("deteriorating");
    expect(result.value).toBe(TREND_VERDICT_VALUES.deteriorating);
  });

  it("returns a flat verdict when the two line items disagree in direction", async () => {
    const growing = {
      units: {
        USD: [
          { start: "2026-03-29", end: "2026-06-27", val: 120, accn: IMPROVING_ACCN, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" },
          { start: "2025-03-30", end: "2025-06-28", val: 100, accn: IMPROVING_ACCN, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" },
        ],
      },
    };
    const shrinking = {
      units: {
        USD: [
          { start: "2026-03-29", end: "2026-06-27", val: 80, accn: IMPROVING_ACCN, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" },
          { start: "2025-03-30", end: "2025-06-28", val: 100, accn: IMPROVING_ACCN, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" },
        ],
      },
    };
    mockEdgarConceptsByTag({ RevenueFromContractWithCustomerExcludingAssessedTax: growing, NetIncomeLoss: shrinking });

    const result = await computeFinancialsTrend("0000320193", IMPROVING_FILING, "ua");

    expect(result.verdict).toBe("flat");
  });

  it("throws financialsUnavailable when no revenue tag candidate has a comparable period", async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/NetIncomeLoss.json")) {
        return jsonResponse(NET_INCOME_FIXTURE);
      }
      return jsonResponse({}, false, 404);
    });

    await expect(computeFinancialsTrend("0000320193", IMPROVING_FILING, "ua")).rejects.toThrow(EdgarError);
  });
});

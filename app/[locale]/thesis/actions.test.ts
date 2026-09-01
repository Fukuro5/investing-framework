import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckEdgarUpdatesState, UpsertThesisState } from "@/app/[locale]/thesis/actions";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

// See app/[locale]/frameworks/actions.test.ts for why this is mocked.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string, params?: Record<string, unknown>) =>
    params ? `${namespace}.${key}:${JSON.stringify(params)}` : `${namespace}.${key}`,
}));

const createMock = vi.fn();

vi.mock("openai", () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(function MockOpenAI() {
    return { chat: { completions: { create: createMock } } };
  }),
}));

const { checkEdgarUpdatesAction, upsertThesisAction } = await import("@/app/[locale]/thesis/actions");

const FIXTURES_DIR = join(process.cwd(), "fixtures/edgar-samples");
const readFixture = (name: string) => JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf-8"));
const REVENUE_FIXTURE = readFixture("revenue-sample.json");
const NET_INCOME_FIXTURE = readFixture("net-income-loss-sample.json");

let testDb: TestDb;
let instrumentId: string;

beforeEach(async () => {
  testDb = createTestDb();
  const instrument = await testDb.prisma.instrument.create({
    data: { ticker: "TSM.US", name: "TSM", assetType: "unknown", currency: "USD" },
  });
  instrumentId = instrument.id;
});

afterEach(async () => {
  await testDb.cleanup();
});

const buildFormData = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
};

describe("upsertThesisAction", () => {
  it("creates a Thesis row from form fields", async () => {
    const state = await upsertThesisAction(
      { status: "idle" } as UpsertThesisState,
      buildFormData({ instrumentId, content: "Durable moat, expanding margins." }),
      testDb.prisma,
    );

    expect(state).toEqual({ status: "idle" });
    const thesis = await testDb.prisma.thesis.findFirstOrThrow();
    expect(thesis).toMatchObject({ instrumentId, content: "Durable moat, expanding margins." });
  });

  it("returns a translated error instead of throwing when the instrument doesn't exist", async () => {
    const state = await upsertThesisAction(
      { status: "idle" } as UpsertThesisState,
      buildFormData({ instrumentId: "missing-instrument", content: "Anything." }),
      testDb.prisma,
    );

    expect(state.status).toBe("error");
    expect(state.errorMessage).toContain("errors.thesis.generic");
  });
});

describe("checkEdgarUpdatesAction", () => {
  const jsonResponse = (body: unknown, ok = true, status = 200) =>
    Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);
  const ACCN = "0000320193-26-000001";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    createMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns a translated error instead of throwing when the ticker has no SEC match", async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/files/company_tickers.json")) return jsonResponse({});
      throw new Error(`Unexpected EDGAR request: ${url}`);
    });

    const state = await checkEdgarUpdatesAction(
      { status: "idle" } as CheckEdgarUpdatesState,
      buildFormData({ instrumentId }),
      testDb.prisma,
      "test-agent contact@example.com",
    );

    expect(state.status).toBe("error");
    expect(state.errorMessage).toContain("errors.edgar.cikNotFound");
  });

  it("reports up to date without touching financials when the accession number hasn't changed", async () => {
    await testDb.prisma.instrument.update({
      where: { id: instrumentId },
      data: { edgarCik: "0000320193", lastCheckedAccessionNumber: ACCN },
    });
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/submissions/CIK")) {
        return jsonResponse({
          filings: { recent: { form: ["10-Q"], filingDate: ["2026-07-31"], accessionNumber: [ACCN], primaryDocument: ["x.htm"] } },
        });
      }
      throw new Error(`Unexpected EDGAR request during an up-to-date check: ${url}`);
    });

    const state = await checkEdgarUpdatesAction(
      { status: "idle" } as CheckEdgarUpdatesState,
      buildFormData({ instrumentId }),
      testDb.prisma,
      "test-agent contact@example.com",
    );

    expect(state).toEqual({ status: "upToDate" });
  });

  it("carries the thesis check through on the updated state when a new filing is found", async () => {
    // Must match an accession number actually present in the revenue/net
    // income fixtures (unlike ACCN above, which is arbitrary since the
    // up-to-date test never reaches the fixture-driven fetch).
    const FIXTURE_ACCN = "0000320193-26-000020";
    await testDb.prisma.thesis.create({ data: { instrumentId, content: "Durable moat, expanding margins." } });
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    createMock.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ verdict: "holding", explanation: "On track." } ) } }] });
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/files/company_tickers.json")) return jsonResponse({ "0": { cik_str: 320193, ticker: "TSM", title: "TSMC" } });
      if (url.includes("/submissions/CIK")) {
        return jsonResponse({
          filings: { recent: { form: ["10-Q"], filingDate: ["2026-07-31"], accessionNumber: [FIXTURE_ACCN], primaryDocument: ["tsm-10q.htm"] } },
        });
      }
      if (url.endsWith("/RevenueFromContractWithCustomerExcludingAssessedTax.json")) return jsonResponse(REVENUE_FIXTURE);
      if (url.endsWith("/NetIncomeLoss.json")) return jsonResponse(NET_INCOME_FIXTURE);
      if (url.includes("/api/xbrl/companyconcept/")) return jsonResponse({}, false, 404);
      if (url.endsWith("/tsm-10q.htm")) return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve("<p>Revenue grew.</p>") } as Response);
      throw new Error(`Unexpected EDGAR request: ${url}`);
    });

    const state = await checkEdgarUpdatesAction(
      { status: "idle" } as CheckEdgarUpdatesState,
      buildFormData({ instrumentId }),
      testDb.prisma,
      "test-agent contact@example.com",
    );

    expect(state).toEqual({
      status: "updated",
      verdict: "improving",
      thesisCheck: { status: "assessed", verdict: "holding", explanation: "On track." },
    });
  });
});

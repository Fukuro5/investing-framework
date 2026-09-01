import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkEdgarUpdatesAction, upsertThesisAction, type CheckEdgarUpdatesState, type UpsertThesisState } from "@/app/[locale]/thesis/actions";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

// See app/[locale]/frameworks/actions.test.ts for why this is mocked.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string, params?: Record<string, unknown>) =>
    params ? `${namespace}.${key}:${JSON.stringify(params)}` : `${namespace}.${key}`,
}));

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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
});

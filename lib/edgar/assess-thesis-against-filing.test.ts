import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";
import type { TrackedFiling } from "@/lib/edgar/get-latest-tracked-filing";

const createMock = vi.fn();

vi.mock("openai", () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(function MockOpenAI() {
    return { chat: { completions: { create: createMock } } };
  }),
}));

const { assessThesisAgainstFiling } = await import("@/lib/edgar/assess-thesis-against-filing");

const FILING: TrackedFiling = { form: "10-Q", filingDate: "2026-07-31", accessionNumber: "0000320193-26-000020", primaryDocument: "aapl-10q.htm" };
const fetchMock = vi.fn();

describe("assessThesisAgainstFiling", () => {
  let testDb: TestDb;
  let instrumentId: string;

  beforeEach(async () => {
    testDb = createTestDb();
    const instrument = await testDb.prisma.instrument.create({
      data: { ticker: "AAPL.US", name: "Apple", assetType: "equity", currency: "USD" },
    });
    instrumentId = instrument.id;
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve("<p>Revenue grew 20%.</p>") });
    createMock.mockReset();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await testDb.cleanup();
  });

  it("returns skippedNoThesis when the instrument has no Thesis row", async () => {
    const result = await assessThesisAgainstFiling(instrumentId, "0000320193", FILING, "ua", testDb.prisma);

    expect(result).toEqual({ status: "skippedNoThesis" });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns skippedNoThesis when the thesis content is blank", async () => {
    await testDb.prisma.thesis.create({ data: { instrumentId, content: "   " } });

    const result = await assessThesisAgainstFiling(instrumentId, "0000320193", FILING, "ua", testDb.prisma);

    expect(result).toEqual({ status: "skippedNoThesis" });
  });

  it("assesses the thesis and persists a ThesisVerdict row on the happy path", async () => {
    await testDb.prisma.thesis.create({ data: { instrumentId, content: "Durable moat, expanding margins." } });
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    createMock.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ verdict: "holding", explanation: "Still tracking." } ) } }] });

    const result = await assessThesisAgainstFiling(instrumentId, "0000320193", FILING, "ua", testDb.prisma);

    expect(result).toEqual({ status: "assessed", verdict: "holding", explanation: "Still tracking." });
    const rows = await testDb.prisma.thesisVerdict.findMany({ where: { instrumentId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ verdict: "holding", explanation: "Still tracking.", accessionNumber: FILING.accessionNumber });
  });

  it("returns failed/missingApiKey without throwing when OPENAI_API_KEY is unset", async () => {
    await testDb.prisma.thesis.create({ data: { instrumentId, content: "Durable moat." } });
    vi.stubEnv("OPENAI_API_KEY", "");

    const result = await assessThesisAgainstFiling(instrumentId, "0000320193", FILING, "ua", testDb.prisma);

    expect(result).toEqual({ status: "failed", code: "missingApiKey" });
  });

  it("returns failed/requestFailed without throwing when the OpenAI call rejects", async () => {
    await testDb.prisma.thesis.create({ data: { instrumentId, content: "Durable moat." } });
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    createMock.mockRejectedValue(new Error("network down"));

    const result = await assessThesisAgainstFiling(instrumentId, "0000320193", FILING, "ua", testDb.prisma);

    expect(result).toEqual({ status: "failed", code: "requestFailed" });
  });
});

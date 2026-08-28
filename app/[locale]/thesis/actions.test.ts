import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { upsertThesisAction, type UpsertThesisState } from "@/app/[locale]/thesis/actions";
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

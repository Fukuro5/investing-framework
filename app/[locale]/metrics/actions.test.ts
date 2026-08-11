import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { upsertManualMetricAction, type UpsertMetricState } from "@/app/[locale]/metrics/actions";
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

describe("upsertManualMetricAction", () => {
  it("creates a manual MetricValue row from form fields", async () => {
    const state = await upsertManualMetricAction(
      { status: "idle" } as UpsertMetricState,
      buildFormData({ instrumentId, metricKey: "roic", value: "18.5", asOfDate: "2026-06-01" }),
      testDb.prisma,
    );

    expect(state).toEqual({ status: "idle" });
    const metric = await testDb.prisma.metricValue.findFirstOrThrow();
    expect(metric).toMatchObject({ metricKey: "roic", value: 18.5, source: "manual" });
  });

  it("returns a translated error for an invalid date instead of throwing", async () => {
    const state = await upsertManualMetricAction(
      { status: "idle" } as UpsertMetricState,
      buildFormData({ instrumentId, metricKey: "roic", value: "18.5", asOfDate: "not-a-date" }),
      testDb.prisma,
    );

    expect(state.status).toBe("error");
    expect(state.errorMessage).toContain("metricAsOfDateInvalid");
    expect(await testDb.prisma.metricValue.count()).toBe(0);
  });

  it("returns a translated error for a non-numeric value instead of throwing", async () => {
    const state = await upsertManualMetricAction(
      { status: "idle" } as UpsertMetricState,
      buildFormData({ instrumentId, metricKey: "roic", value: "not-a-number", asOfDate: "2026-06-01" }),
      testDb.prisma,
    );

    expect(state.status).toBe("error");
    expect(state.errorMessage).toContain("metricValueMustBeNumber");
  });
});

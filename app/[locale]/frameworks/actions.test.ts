import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFrameworkAction, deleteFrameworkAction, type CreateFrameworkState } from "@/app/[locale]/frameworks/actions";
import type { DeleteActionState } from "@/components/DeleteButton";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

// getTranslations/getLocale resolve to a "not supported in Client
// Components" stub under Vitest's jsdom environment — there's no real
// Next.js request context to read from. Mocked here so the action's own
// logic (formData parsing, which lib function it calls, response shape)
// is still testable; exact translated wording is covered by messages/*.json
// and the manual browser smoke test.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string, params?: Record<string, unknown>) =>
    params ? `${namespace}.${key}:${JSON.stringify(params)}` : `${namespace}.${key}`,
  getLocale: async () => "en",
}));

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
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

describe("createFrameworkAction (error path)", () => {
  it("returns a translated error message for a blank name, without touching the database", async () => {
    const state = await createFrameworkAction(
      { status: "idle" } as CreateFrameworkState,
      buildFormData({ name: "  ", description: "" }),
      testDb.prisma,
    );

    expect(state).toEqual({ status: "error", errorMessage: "errors.frameworks.frameworkNameRequired:{}" });
    expect(await testDb.prisma.framework.count()).toBe(0);
  });

  it("includes the conflicting name as a param for a duplicate framework", async () => {
    await testDb.prisma.framework.create({ data: { name: "Quality" } });

    const state = await createFrameworkAction(
      { status: "idle" } as CreateFrameworkState,
      buildFormData({ name: "Quality", description: "" }),
      testDb.prisma,
    );

    expect(state).toEqual({
      status: "error",
      errorMessage: 'errors.frameworks.frameworkNameTaken:{"name":"Quality"}',
    });
  });
});

describe("deleteFrameworkAction", () => {
  it("deletes the framework and returns idle", async () => {
    const framework = await testDb.prisma.framework.create({ data: { name: "Quality" } });

    const state = await deleteFrameworkAction(
      { status: "idle" } as DeleteActionState,
      buildFormData({ frameworkId: framework.id }),
      testDb.prisma,
    );

    expect(state).toEqual({ status: "idle" });
    expect(await testDb.prisma.framework.count()).toBe(0);
  });
});

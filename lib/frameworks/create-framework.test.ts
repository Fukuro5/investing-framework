import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFramework } from "@/lib/frameworks/create-framework";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(async () => {
  await testDb.cleanup();
});

describe("createFramework", () => {
  it("creates a framework with a trimmed name", async () => {
    const framework = await createFramework({ name: "  Quality  ", description: "Core + convexity" }, testDb.prisma);

    expect(framework).toMatchObject({ name: "Quality", description: "Core + convexity", isActive: false });
  });

  it("throws for a blank name", async () => {
    await expect(createFramework({ name: "   ", description: null }, testDb.prisma)).rejects.toThrow(/name is required/);
  });

  it("throws when a framework with that name already exists (unique constraint)", async () => {
    await createFramework({ name: "Quality", description: null }, testDb.prisma);

    await expect(createFramework({ name: "Quality", description: null }, testDb.prisma)).rejects.toThrow(
      /already exists/,
    );
  });
});

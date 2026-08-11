import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFramework } from "@/lib/frameworks/create-framework";
import { updateFramework } from "@/lib/frameworks/update-framework";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(async () => {
  await testDb.cleanup();
});

describe("updateFramework", () => {
  it("updates the name and description", async () => {
    const framework = await createFramework({ name: "Quality", description: null }, testDb.prisma);

    const updated = await updateFramework(
      { frameworkId: framework.id, name: "Quality v2", description: "Renamed" },
      testDb.prisma,
    );

    expect(updated).toMatchObject({ name: "Quality v2", description: "Renamed" });
  });

  it("throws for a blank name", async () => {
    const framework = await createFramework({ name: "Quality", description: null }, testDb.prisma);

    await expect(
      updateFramework({ frameworkId: framework.id, name: " ", description: null }, testDb.prisma),
    ).rejects.toThrow(/name is required/);
  });

  it("throws when renaming to a name already used by a different framework", async () => {
    await createFramework({ name: "Quality", description: null }, testDb.prisma);
    const momentum = await createFramework({ name: "Momentum", description: null }, testDb.prisma);

    await expect(
      updateFramework({ frameworkId: momentum.id, name: "Quality", description: null }, testDb.prisma),
    ).rejects.toThrow(/already exists/);
  });
});

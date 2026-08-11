import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { importStatement, type ImportStatementState } from "@/app/[locale]/import/actions";
import { createTestDb, type TestDb } from "@/lib/import/ingest/__tests__/test-db";

const FIXTURE_PATH = join(process.cwd(), "fixtures/broker-samples/freedom-finance-2026-07.json");
const hasFixture = existsSync(FIXTURE_PATH);

const IDLE_STATE: ImportStatementState = { status: "idle" };

const buildFormData = (file: File | null): FormData => {
  const formData = new FormData();

  if (file) {
    formData.set("file", file);
  }

  return formData;
};

describe("importStatement (error paths, no database access)", () => {
  it("returns invalidFile when no file is submitted", async () => {
    const state = await importStatement(IDLE_STATE, buildFormData(null));

    expect(state).toEqual({ status: "error", errorKey: "invalidFile" });
  });

  it("returns invalidFile when the file isn't valid JSON", async () => {
    const file = new File(["not json"], "statement.json", { type: "application/json" });

    const state = await importStatement(IDLE_STATE, buildFormData(file));

    expect(state).toEqual({ status: "error", errorKey: "invalidFile" });
  });
});

// This fixture is a real (gitignored) statement — see PLANNING.md §4. It
// won't exist on a fresh clone or in CI, so this suite skips rather than
// fails when it's absent instead of depending on personal data being present.
describe.skipIf(!hasFixture)("importStatement (real fixture, isolated test database)", () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  it("ingests the real statement and reports the transaction/position counts", async () => {
    const bytes = readFileSync(FIXTURE_PATH);
    const file = new File([bytes], "freedom-finance-2026-07.json", { type: "application/json" });

    const state = await importStatement(IDLE_STATE, buildFormData(file), testDb.prisma);

    expect(state).toEqual({ status: "success", transactionCount: 2, positionCount: 2 });
  });

  it("reports no-new-transactions when the same statement is imported twice", async () => {
    const bytes = readFileSync(FIXTURE_PATH);
    const file = () => new File([bytes], "freedom-finance-2026-07.json", { type: "application/json" });

    await importStatement(IDLE_STATE, buildFormData(file()), testDb.prisma);
    const second = await importStatement(IDLE_STATE, buildFormData(file()), testDb.prisma);

    expect(second).toEqual({ status: "no-new-transactions" });
  });
});

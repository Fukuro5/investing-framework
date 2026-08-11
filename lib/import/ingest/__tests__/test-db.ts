import Database from "better-sqlite3";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const MIGRATIONS_DIR = join(process.cwd(), "prisma/migrations");

const buildSchema = (dbPath: string) => {
  const db = new Database(dbPath);
  const migrationFolders = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const folder of migrationFolders) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, folder, "migration.sql"), "utf-8"));
  }

  db.close();
};

export interface TestDb {
  prisma: PrismaClient;
  cleanup: () => Promise<void>;
}

// A fresh SQLite file per test suite, built from the real migration files —
// not mocked Prisma calls — so ingestion tests exercise actual unique
// constraints (dedup) and upserts. better-sqlite3 builds the schema
// directly; Prisma's driver adapter then connects to that same file.
export const createTestDb = (): TestDb => {
  const dbPath = join(tmpdir(), `investing-framework-test-${crypto.randomUUID()}.db`);
  buildSchema(dbPath);

  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });

  const cleanup = async () => {
    await prisma.$disconnect();
    rmSync(dbPath, { force: true });
  };

  return { prisma, cleanup };
};

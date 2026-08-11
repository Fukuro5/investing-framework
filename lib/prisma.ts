import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient, type Prisma } from '@prisma/client';

export type TransactionClient = Prisma.TransactionClient;

declare global {
  var prismaClient: PrismaClient | undefined;
}

const getDatabaseUrl = () => {
  const { DATABASE_URL } = process.env;

  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  return DATABASE_URL;
};

const createPrismaClient = () => {
  const adapter = new PrismaBetterSqlite3({ url: getDatabaseUrl() });
  return new PrismaClient({ adapter });
};

// Reuse the client across Next.js dev-mode hot reloads instead of exhausting
// SQLite connections with a new PrismaClient per reload.
export const prisma = globalThis.prismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaClient = prisma;
}

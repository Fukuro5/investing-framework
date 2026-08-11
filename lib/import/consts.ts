export const BROKERS = ['freedom-finance', 'interactive-brokers'] as const;

export const TRANSACTION_TYPES = [
  'buy',
  'sell',
  'dividend',
  'fee',
  'tax',
  'deposit',
  'withdrawal',
] as const;

// Transaction.type is a plain String column (SQLite has no enum support —
// see prisma/schema.prisma), so a value read back from the database is only
// known to be a string until narrowed against the domain union.
export const isTransactionType = (value: string): value is (typeof TRANSACTION_TYPES)[number] =>
  TRANSACTION_TYPES.includes(value as (typeof TRANSACTION_TYPES)[number]);

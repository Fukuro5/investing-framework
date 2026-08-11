import type { BROKERS, TRANSACTION_TYPES } from '@/lib/import/consts';

export type Broker = (typeof BROKERS)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export interface NormalizedInstrumentRef {
  ticker: string;
  isin: string | null;
  name: string;
  assetType: string;
  currency: string;
  exchange: string | null;
}

// instrument is null for account-level activity with no security attached
// (deposits, withdrawals, account fees).
export interface NormalizedTransaction {
  brokerRef: string;
  type: TransactionType;
  date: Date;
  instrument: NormalizedInstrumentRef | null;
  quantity: number | null;
  price: number | null;
  fees: number | null;
  currency: string;
}

export interface NormalizedPositionSnapshot {
  instrument: NormalizedInstrumentRef;
  asOfDate: Date;
  quantity: number;
  avgCostPrice: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  currency: string;
}

export interface ParsedStatement {
  broker: Broker;
  account: { label: string; baseCurrency: string };
  period: { start: Date; end: Date };
  transactions: NormalizedTransaction[];
  positionSnapshots: NormalizedPositionSnapshot[];
}

// Every broker/format parser implements this same shape (PLANNING.md §4) —
// ingestion, dedup, and storage never change when a new one is added.
export type StatementParser = (file: Buffer | string) => ParsedStatement;

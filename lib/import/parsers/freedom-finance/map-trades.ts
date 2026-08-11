import { toDate, toNumber } from "@/lib/import/parsers/freedom-finance/normalize";
import type { FreedomFinanceTradeRaw } from "@/lib/import/parsers/freedom-finance/raw-types";
import type { NormalizedInstrumentRef, NormalizedTransaction, TransactionType } from "@/lib/import/types";

const mapTradeOperation = (operation: string): TransactionType => {
  if (operation === "buy" || operation === "sell") {
    return operation;
  }

  throw new Error(`Freedom Finance statement: unrecognized trade operation "${operation}" (expected "buy" or "sell")`);
};

const buildInstrumentRef = (trade: FreedomFinanceTradeRaw): NormalizedInstrumentRef => ({
  ticker: trade.instr_nm,
  isin: trade.issue_nb,
  name: trade.instr_nm,
  assetType: trade.instr_kind ?? "unknown",
  currency: trade.curr_c,
  exchange: null,
});

export const mapTrades = (trades: FreedomFinanceTradeRaw[]): NormalizedTransaction[] =>
  trades.map((trade) => ({
    brokerRef: String(trade.transaction_id),
    type: mapTradeOperation(trade.operation),
    date: toDate(trade.date),
    instrument: buildInstrumentRef(trade),
    quantity: toNumber(trade.q),
    price: toNumber(trade.p),
    fees: toNumber(trade.commission),
    currency: trade.curr_c,
  }));

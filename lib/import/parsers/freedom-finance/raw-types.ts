// Shapes for the Freedom Finance JSON export fields this parser actually
// reads (PLANNING.md §4) — not the full broker export, which has many more
// fields left empty/unused in the real sample. Some fields the broker
// serializes inconsistently as either a string or a number (e.g. mkt_price
// is a string, mval is a number) — string | number here reflects that,
// normalized later via toNumber().

export interface FreedomFinancePositionRaw {
  i: string;
  q: string | number;
  curr: string;
  name: string;
  issue_nb: string;
  mkt_price: string | number;
  price_a: string | number;
  mval: string | number;
  unrealized_profit: string | number;
}

export interface FreedomFinanceTradeRaw {
  transaction_id: string | number;
  operation: string;
  p: string | number;
  q: string | number;
  commission: string | number;
  curr_c: string;
  date: string;
  issue_nb: string;
  instr_nm: string;
  instr_kind: string | null;
}

export interface FreedomFinanceCashInOutRaw {
  transaction_id: string | number;
  // Real field is "type" (e.g. "dividend"), not "type_id" as PLANNING.md §4
  // states — that description actually matches corporate_actions.detailed's
  // type_id field below. Confirmed against the real sample fixture.
  type: string;
  ticker: string | null;
  datetime: string;
  currency: string;
  commission: string | number;
  amount: string | number;
  corporate_action_id: string | null;
}

export interface FreedomFinanceCorporateActionRaw {
  corporate_action_id: string;
  type_id: string;
  ticker: string;
  isin: string;
  currency: string;
  amount_per_one: string | number;
  external_tax: string | number;
  external_tax_currency: string;
  q_on_ex_date: string | number;
}

export interface FreedomFinancePositionsBlock {
  date: string;
  account: {
    positions_from_ts: {
      ps: {
        acc: FreedomFinancePositionRaw[];
      };
    };
  };
}

export interface FreedomFinanceStatementRaw {
  date_start: string;
  date_end: string;
  plainAccountInfoData: {
    base_currency: string;
    client_code: string;
  };
  account_at_start: FreedomFinancePositionsBlock;
  account_at_end: FreedomFinancePositionsBlock;
  trades: { detailed: FreedomFinanceTradeRaw[] };
  cash_in_outs: FreedomFinanceCashInOutRaw[];
  corporate_actions: { detailed: FreedomFinanceCorporateActionRaw[] };
}

// Shapes for the Freedom Finance JSON export fields this parser actually
// reads (PLANNING.md §4) — this app only imports position snapshots from
// this broker (ticker, quantity, avg cost, market value, unrealized P&L),
// not trades or cash movements. Some fields the broker serializes
// inconsistently as either a string or a number (e.g. mkt_price is a
// string, mval is a number) — string | number here reflects that,
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

export interface FreedomFinancePositionsBlock {
  date: string;
  positions: FreedomFinancePositionRaw[];
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
}

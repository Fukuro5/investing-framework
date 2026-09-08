import {
  assertArray,
  assertObject,
  assertString,
  assertStringOrNumber,
  isObject,
} from "@/lib/import/parsers/freedom-finance/assertions";
import type {
  FreedomFinancePositionRaw,
  FreedomFinancePositionsBlock,
  FreedomFinanceStatementRaw,
} from "@/lib/import/parsers/freedom-finance/raw-types";

const validatePosition = (value: unknown, path: string): FreedomFinancePositionRaw => {
  const raw = assertObject(value, path);

  return {
    i: assertString(raw.i, `${path}.i`),
    q: assertStringOrNumber(raw.q, `${path}.q`),
    curr: assertString(raw.curr, `${path}.curr`),
    name: assertString(raw.name, `${path}.name`),
    issue_nb: assertString(raw.issue_nb, `${path}.issue_nb`),
    mkt_price: assertStringOrNumber(raw.mkt_price, `${path}.mkt_price`),
    price_a: assertStringOrNumber(raw.price_a, `${path}.price_a`),
    mval: assertStringOrNumber(raw.mval, `${path}.mval`),
    unrealized_profit: assertStringOrNumber(raw.unrealized_profit, `${path}.unrealized_profit`),
  };
};

// Freedom Finance splits this block's `ps` into `acc` (per-currency cash
// balance lines — no `i`) and `pos` (actual security holdings). Which array
// carries real positions varies by account: some accounts have no `pos` at
// all and put the security directly under `acc`. Merging both and keeping
// only entries with a string `i` handles either shape.
const isSecurityPositionEntry = (value: unknown): value is Record<string, unknown> =>
  isObject(value) && typeof value.i === "string";

const validatePositionsBlock = (value: unknown, path: string): FreedomFinancePositionsBlock => {
  const raw = assertObject(value, path);
  const account = assertObject(raw.account, `${path}.account`);
  const positionsFromTs = assertObject(account.positions_from_ts, `${path}.account.positions_from_ts`);
  const ps = assertObject(positionsFromTs.ps, `${path}.account.positions_from_ts.ps`);
  const acc = assertArray(ps.acc, `${path}.account.positions_from_ts.ps.acc`);
  const pos = ps.pos === null || ps.pos === undefined ? [] : assertArray(ps.pos, `${path}.account.positions_from_ts.ps.pos`);
  const securityEntries = [...acc, ...pos].filter(isSecurityPositionEntry);

  return {
    date: assertString(raw.date, `${path}.date`),
    positions: securityEntries.map((item, index) => validatePosition(item, `${path}.account.positions_from_ts.ps[${index}]`)),
  };
};

export const validateFreedomFinanceStatement = (value: unknown): FreedomFinanceStatementRaw => {
  const raw = assertObject(value, "$");
  const plainAccountInfoData = assertObject(raw.plainAccountInfoData, "$.plainAccountInfoData");

  return {
    date_start: assertString(raw.date_start, "$.date_start"),
    date_end: assertString(raw.date_end, "$.date_end"),
    plainAccountInfoData: {
      base_currency: assertString(plainAccountInfoData.base_currency, "$.plainAccountInfoData.base_currency"),
      client_code: assertString(plainAccountInfoData.client_code, "$.plainAccountInfoData.client_code"),
    },
    account_at_start: validatePositionsBlock(raw.account_at_start, "$.account_at_start"),
    account_at_end: validatePositionsBlock(raw.account_at_end, "$.account_at_end"),
  };
};

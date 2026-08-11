import {
  assertArray,
  assertObject,
  assertString,
  assertStringOrNull,
  assertStringOrNumber,
} from "@/lib/import/parsers/freedom-finance/assertions";
import type {
  FreedomFinanceCashInOutRaw,
  FreedomFinanceCorporateActionRaw,
  FreedomFinancePositionRaw,
  FreedomFinancePositionsBlock,
  FreedomFinanceStatementRaw,
  FreedomFinanceTradeRaw,
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

const validatePositionsBlock = (value: unknown, path: string): FreedomFinancePositionsBlock => {
  const raw = assertObject(value, path);
  const account = assertObject(raw.account, `${path}.account`);
  const positionsFromTs = assertObject(account.positions_from_ts, `${path}.account.positions_from_ts`);
  const ps = assertObject(positionsFromTs.ps, `${path}.account.positions_from_ts.ps`);
  const acc = assertArray(ps.acc, `${path}.account.positions_from_ts.ps.acc`);

  return {
    date: assertString(raw.date, `${path}.date`),
    account: {
      positions_from_ts: {
        ps: { acc: acc.map((item, index) => validatePosition(item, `${path}.account.positions_from_ts.ps.acc[${index}]`)) },
      },
    },
  };
};

const validateTrade = (value: unknown, path: string): FreedomFinanceTradeRaw => {
  const raw = assertObject(value, path);

  return {
    transaction_id: assertStringOrNumber(raw.transaction_id, `${path}.transaction_id`),
    operation: assertString(raw.operation, `${path}.operation`),
    p: assertStringOrNumber(raw.p, `${path}.p`),
    q: assertStringOrNumber(raw.q, `${path}.q`),
    commission: assertStringOrNumber(raw.commission, `${path}.commission`),
    curr_c: assertString(raw.curr_c, `${path}.curr_c`),
    date: assertString(raw.date, `${path}.date`),
    issue_nb: assertString(raw.issue_nb, `${path}.issue_nb`),
    instr_nm: assertString(raw.instr_nm, `${path}.instr_nm`),
    instr_kind: raw.instr_kind === null || raw.instr_kind === undefined ? null : assertString(raw.instr_kind, `${path}.instr_kind`),
  };
};

const validateCashInOut = (value: unknown, path: string): FreedomFinanceCashInOutRaw => {
  const raw = assertObject(value, path);

  return {
    transaction_id: assertStringOrNumber(raw.transaction_id, `${path}.transaction_id`),
    type: assertString(raw.type, `${path}.type`),
    ticker: raw.ticker === null || raw.ticker === undefined ? null : assertString(raw.ticker, `${path}.ticker`),
    datetime: assertString(raw.datetime, `${path}.datetime`),
    currency: assertString(raw.currency, `${path}.currency`),
    commission: assertStringOrNumber(raw.commission, `${path}.commission`),
    amount: assertStringOrNumber(raw.amount, `${path}.amount`),
    corporate_action_id: assertStringOrNull(raw.corporate_action_id, `${path}.corporate_action_id`),
  };
};

const validateCorporateAction = (value: unknown, path: string): FreedomFinanceCorporateActionRaw => {
  const raw = assertObject(value, path);

  return {
    corporate_action_id: assertString(raw.corporate_action_id, `${path}.corporate_action_id`),
    type_id: assertString(raw.type_id, `${path}.type_id`),
    ticker: assertString(raw.ticker, `${path}.ticker`),
    isin: assertString(raw.isin, `${path}.isin`),
    currency: assertString(raw.currency, `${path}.currency`),
    amount_per_one: assertStringOrNumber(raw.amount_per_one, `${path}.amount_per_one`),
    external_tax: assertStringOrNumber(raw.external_tax, `${path}.external_tax`),
    external_tax_currency: assertString(raw.external_tax_currency, `${path}.external_tax_currency`),
    q_on_ex_date: assertStringOrNumber(raw.q_on_ex_date, `${path}.q_on_ex_date`),
  };
};

export const validateFreedomFinanceStatement = (value: unknown): FreedomFinanceStatementRaw => {
  const raw = assertObject(value, "$");
  const plainAccountInfoData = assertObject(raw.plainAccountInfoData, "$.plainAccountInfoData");
  const trades = assertObject(raw.trades, "$.trades");
  const tradesDetailed = assertArray(trades.detailed, "$.trades.detailed");
  const cashInOuts = assertArray(raw.cash_in_outs, "$.cash_in_outs");
  const corporateActions = assertObject(raw.corporate_actions, "$.corporate_actions");
  const corporateActionsDetailed = assertArray(corporateActions.detailed, "$.corporate_actions.detailed");

  return {
    date_start: assertString(raw.date_start, "$.date_start"),
    date_end: assertString(raw.date_end, "$.date_end"),
    plainAccountInfoData: {
      base_currency: assertString(plainAccountInfoData.base_currency, "$.plainAccountInfoData.base_currency"),
      client_code: assertString(plainAccountInfoData.client_code, "$.plainAccountInfoData.client_code"),
    },
    account_at_start: validatePositionsBlock(raw.account_at_start, "$.account_at_start"),
    account_at_end: validatePositionsBlock(raw.account_at_end, "$.account_at_end"),
    trades: { detailed: tradesDetailed.map((item, index) => validateTrade(item, `$.trades.detailed[${index}]`)) },
    cash_in_outs: cashInOuts.map((item, index) => validateCashInOut(item, `$.cash_in_outs[${index}]`)),
    corporate_actions: {
      detailed: corporateActionsDetailed.map((item, index) =>
        validateCorporateAction(item, `$.corporate_actions.detailed[${index}]`),
      ),
    },
  };
};

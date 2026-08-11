import { CASH_IN_OUT_TYPE_ID_MAP } from "@/lib/import/parsers/freedom-finance/consts";
import { toDate, toNumber } from "@/lib/import/parsers/freedom-finance/normalize";
import type {
  FreedomFinanceCashInOutRaw,
  FreedomFinanceCorporateActionRaw,
} from "@/lib/import/parsers/freedom-finance/raw-types";
import type { NormalizedInstrumentRef, NormalizedTransaction, TransactionType } from "@/lib/import/types";

const mapCashInOutType = (rawType: string): TransactionType => {
  const type = CASH_IN_OUT_TYPE_ID_MAP[rawType];

  if (!type) {
    throw new Error(
      `Freedom Finance statement: unrecognized cash_in_outs.type "${rawType}" — add it to CASH_IN_OUT_TYPE_ID_MAP once confirmed against a real sample`,
    );
  }

  return type;
};

const buildInstrumentRef = (
  entry: FreedomFinanceCashInOutRaw,
  action: FreedomFinanceCorporateActionRaw | undefined,
): NormalizedInstrumentRef | null => {
  if (!entry.ticker) {
    return null;
  }

  return {
    ticker: entry.ticker,
    isin: action?.isin ?? null,
    name: entry.ticker,
    assetType: "unknown",
    currency: entry.currency,
    exchange: null,
  };
};

// Cross-references corporate_actions by corporate_action_id to enrich the
// dividend with tax withheld — see PLANNING.md §4. The corporate action
// also supplies the gross per-share rate and shares-on-record-date, which
// this parser prefers over the cash_in_outs.amount (net-of-tax) figure so
// that quantity * price recovers the gross dividend consistently with how
// buy/sell transactions represent value.
const buildDividendTransaction = (
  entry: FreedomFinanceCashInOutRaw,
  action: FreedomFinanceCorporateActionRaw | undefined,
  type: TransactionType,
): NormalizedTransaction => ({
  brokerRef: String(entry.transaction_id),
  type,
  date: toDate(entry.datetime),
  instrument: buildInstrumentRef(entry, action),
  quantity: action ? toNumber(action.q_on_ex_date) : 1,
  price: action ? toNumber(action.amount_per_one) : toNumber(entry.amount),
  fees: toNumber(entry.commission),
  currency: entry.currency,
});

const buildTaxTransaction = (
  entry: FreedomFinanceCashInOutRaw,
  action: FreedomFinanceCorporateActionRaw | undefined,
): NormalizedTransaction | null => {
  if (!action || toNumber(action.external_tax) === 0) {
    return null;
  }

  return {
    brokerRef: `tax:${action.corporate_action_id}`,
    type: "tax",
    date: toDate(entry.datetime),
    instrument: buildInstrumentRef(entry, action),
    quantity: 1,
    price: toNumber(action.external_tax),
    fees: null,
    currency: action.external_tax_currency,
  };
};

export const mapCashInOuts = (
  cashInOuts: FreedomFinanceCashInOutRaw[],
  corporateActions: FreedomFinanceCorporateActionRaw[],
): NormalizedTransaction[] => {
  const actionsById = new Map(corporateActions.map((action) => [action.corporate_action_id, action]));

  return cashInOuts.flatMap((entry) => {
    const type = mapCashInOutType(entry.type);
    const action = entry.corporate_action_id ? actionsById.get(entry.corporate_action_id) : undefined;
    const dividendTransaction = buildDividendTransaction(entry, action, type);
    const taxTransaction = buildTaxTransaction(entry, action);

    return taxTransaction ? [dividendTransaction, taxTransaction] : [dividendTransaction];
  });
};

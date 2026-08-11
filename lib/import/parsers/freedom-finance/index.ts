import { mapCashInOuts } from "@/lib/import/parsers/freedom-finance/map-cash-in-outs";
import { mapPositionSnapshots } from "@/lib/import/parsers/freedom-finance/map-positions";
import { mapTrades } from "@/lib/import/parsers/freedom-finance/map-trades";
import { toDate } from "@/lib/import/parsers/freedom-finance/normalize";
import type { FreedomFinanceStatementRaw } from "@/lib/import/parsers/freedom-finance/raw-types";
import { validateFreedomFinanceStatement } from "@/lib/import/parsers/freedom-finance/validate";
import type { ParsedStatement, StatementParser } from "@/lib/import/types";

const buildAccountLabel = (info: FreedomFinanceStatementRaw["plainAccountInfoData"]) =>
  `Freedom Finance ${info.client_code}`;

const readFreedomFinanceStatement = (file: Buffer | string): FreedomFinanceStatementRaw => {
  const text = typeof file === "string" ? file : file.toString("utf-8");

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Freedom Finance statement: file is not valid JSON");
  }

  return validateFreedomFinanceStatement(parsed);
};

export const parseFreedomFinanceStatement: StatementParser = (file): ParsedStatement => {
  const raw = readFreedomFinanceStatement(file);

  return {
    broker: "freedom-finance",
    account: {
      label: buildAccountLabel(raw.plainAccountInfoData),
      baseCurrency: raw.plainAccountInfoData.base_currency,
    },
    period: { start: toDate(raw.date_start), end: toDate(raw.date_end) },
    transactions: [...mapTrades(raw.trades.detailed), ...mapCashInOuts(raw.cash_in_outs, raw.corporate_actions.detailed)],
    positionSnapshots: [
      ...mapPositionSnapshots(raw.account_at_start.account.positions_from_ts.ps.acc, toDate(raw.account_at_start.date)),
      ...mapPositionSnapshots(raw.account_at_end.account.positions_from_ts.ps.acc, toDate(raw.account_at_end.date)),
    ],
  };
};

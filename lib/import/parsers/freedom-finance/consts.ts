import type { TransactionType } from "@/lib/import/types";

// Only "dividend" is confirmed against a real Freedom Finance export
// (fixtures/broker-samples/freedom-finance-2026-07.json — see PLANNING.md
// §4). Other cash_in_outs.type_id values throw in mapCashInOutTypeId until
// confirmed against a real sample, rather than being guessed.
export const CASH_IN_OUT_TYPE_ID_MAP: Record<string, TransactionType> = {
  dividend: "dividend",
};

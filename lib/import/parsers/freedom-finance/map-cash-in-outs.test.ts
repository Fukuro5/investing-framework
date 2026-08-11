import { describe, expect, it } from "vitest";
import { mapCashInOuts } from "@/lib/import/parsers/freedom-finance/map-cash-in-outs";
import type {
  FreedomFinanceCashInOutRaw,
  FreedomFinanceCorporateActionRaw,
} from "@/lib/import/parsers/freedom-finance/raw-types";

const dividendEntry: FreedomFinanceCashInOutRaw = {
  transaction_id: 3690173612,
  type: "dividend",
  ticker: "TSM.US",
  datetime: "2026-07-14 11:42:25",
  currency: "USD",
  commission: "0.00000000",
  amount: "3.71000000",
  corporate_action_id: "2026-06-11_35_TSM.US_0.939325",
};

const dividendAction: FreedomFinanceCorporateActionRaw = {
  corporate_action_id: "2026-06-11_35_TSM.US_0.939325",
  type_id: "dividend",
  ticker: "TSM.US",
  isin: "US8740391003",
  currency: "USD",
  amount_per_one: 0.939325,
  external_tax: 0.99,
  external_tax_currency: "USD",
  q_on_ex_date: "5.00000000",
};

describe("mapCashInOuts", () => {
  it("produces a gross dividend transaction and a linked tax transaction when a corporate action matches", () => {
    const [dividend, tax] = mapCashInOuts([dividendEntry], [dividendAction]);

    expect(dividend).toEqual({
      brokerRef: "3690173612",
      type: "dividend",
      date: new Date("2026-07-14T11:42:25.000Z"),
      instrument: {
        ticker: "TSM.US",
        isin: "US8740391003",
        name: "TSM.US",
        assetType: "unknown",
        currency: "USD",
        exchange: null,
      },
      quantity: 5,
      price: 0.939325,
      fees: 0,
      currency: "USD",
    });

    expect(tax).toEqual({
      brokerRef: "tax:2026-06-11_35_TSM.US_0.939325",
      type: "tax",
      date: new Date("2026-07-14T11:42:25.000Z"),
      instrument: {
        ticker: "TSM.US",
        isin: "US8740391003",
        name: "TSM.US",
        assetType: "unknown",
        currency: "USD",
        exchange: null,
      },
      quantity: 1,
      price: 0.99,
      fees: null,
      currency: "USD",
    });
  });

  it("falls back to the cash amount and skips the tax row when no corporate action matches", () => {
    const orphanEntry: FreedomFinanceCashInOutRaw = { ...dividendEntry, corporate_action_id: "missing-id" };
    const transactions = mapCashInOuts([orphanEntry], [dividendAction]);

    expect(transactions).toEqual([
      {
        brokerRef: "3690173612",
        type: "dividend",
        date: new Date("2026-07-14T11:42:25.000Z"),
        instrument: {
          ticker: "TSM.US",
          isin: null,
          name: "TSM.US",
          assetType: "unknown",
          currency: "USD",
          exchange: null,
        },
        quantity: 1,
        price: 3.71,
        fees: 0,
        currency: "USD",
      },
    ]);
  });

  it("throws for an unrecognized type", () => {
    const unknownEntry: FreedomFinanceCashInOutRaw = { ...dividendEntry, type: "loan-interest" };

    expect(() => mapCashInOuts([unknownEntry], [])).toThrow(/unrecognized cash_in_outs.type "loan-interest"/);
  });
});

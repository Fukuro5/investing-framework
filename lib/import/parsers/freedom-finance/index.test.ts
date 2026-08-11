import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFreedomFinanceStatement } from "@/lib/import/parsers/freedom-finance";

const FIXTURE_PATH = join(process.cwd(), "fixtures/broker-samples/freedom-finance-2026-07.json");
const hasFixture = existsSync(FIXTURE_PATH);

// This fixture is a real (gitignored) statement — see PLANNING.md §4. It
// won't exist on a fresh clone or in CI, so this suite skips rather than
// fails when it's absent instead of depending on personal data being present.
describe.skipIf(!hasFixture)("parseFreedomFinanceStatement (real fixture)", () => {
  it("parses account info, period, position snapshots, and transactions", () => {
    const file = readFileSync(FIXTURE_PATH);
    const statement = parseFreedomFinanceStatement(file);

    expect(statement.broker).toBe("freedom-finance");
    expect(statement.account).toEqual({ label: "Freedom Finance 000", baseCurrency: "USD" });
    expect(statement.period).toEqual({
      start: new Date("2026-06-30T23:59:59.000Z"),
      end: new Date("2026-07-31T23:59:59.000Z"),
    });

    // No trades in this period's real sample — only the position snapshot
    // and dividend/tax activity are exercised end-to-end here.
    expect(statement.transactions).toEqual([
      {
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
      },
      {
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
      },
    ]);

    expect(statement.positionSnapshots).toHaveLength(2);
    expect(statement.positionSnapshots[0]).toMatchObject({
      asOfDate: new Date("2026-06-30T23:59:59.000Z"),
      quantity: 5,
      marketPrice: 477.57,
      marketValue: 2387.85,
      unrealizedPnl: 542.04,
    });
    expect(statement.positionSnapshots[1]).toMatchObject({
      asOfDate: new Date("2026-07-31T23:59:59.000Z"),
      quantity: 5,
      marketPrice: 404.25,
      marketValue: 2021.25,
      unrealizedPnl: 175.44,
    });
  });
});

describe("parseFreedomFinanceStatement (error handling)", () => {
  it("throws a clear error for a file that isn't valid JSON", () => {
    expect(() => parseFreedomFinanceStatement("not json")).toThrow(/not valid JSON/);
  });

  it("throws a clear error when a required field is missing", () => {
    const incomplete = {
      date_start: "2026-01-01",
      plainAccountInfoData: { base_currency: "USD", client_code: "000" },
      account_at_start: { date: "2026-01-01", account: { positions_from_ts: { ps: { acc: [] } } } },
      account_at_end: { date: "2026-01-31", account: { positions_from_ts: { ps: { acc: [] } } } },
      trades: { detailed: [] },
      cash_in_outs: [],
      corporate_actions: { detailed: [] },
    };

    expect(() => parseFreedomFinanceStatement(JSON.stringify(incomplete))).toThrow(
      /expected a string at "\$\.date_end"/,
    );
  });
});

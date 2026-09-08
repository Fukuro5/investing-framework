import { describe, expect, it } from "vitest";
import { validateFreedomFinanceStatement } from "@/lib/import/parsers/freedom-finance/validate";

const cashBalanceLine = { curr: "EUR", k: 34, t: 6, posval: 0 };

const securityPosition = {
  i: "TSM.US",
  q: 5,
  curr: "USD",
  name: "Taiwan Semiconductor",
  issue_nb: "US8740391003",
  mkt_price: "404.25",
  price_a: 369.1612,
  mval: 2021.25,
  unrealized_profit: 175.44,
};

const buildPositionsBlock = (ps: Record<string, unknown>) => ({
  date: "2026-07-31 23:59:59",
  account: { positions_from_ts: { ps } },
});

const buildStatement = (positionsBlock: ReturnType<typeof buildPositionsBlock>) => ({
  date_start: "2026-07-01 00:00:00",
  date_end: "2026-07-31 23:59:59",
  plainAccountInfoData: { base_currency: "USD", client_code: "000" },
  account_at_start: positionsBlock,
  account_at_end: positionsBlock,
});

describe("validateFreedomFinanceStatement", () => {
  it("keeps a security position that lives under ps.acc alongside a cash balance line", () => {
    const statement = buildStatement(buildPositionsBlock({ acc: [cashBalanceLine, securityPosition] }));

    const result = validateFreedomFinanceStatement(statement);

    expect(result.account_at_start.positions).toEqual([securityPosition]);
  });

  it("keeps a security position that lives under ps.pos while ps.acc holds only cash balance lines", () => {
    const statement = buildStatement(buildPositionsBlock({ acc: [cashBalanceLine], pos: [securityPosition] }));

    const result = validateFreedomFinanceStatement(statement);

    expect(result.account_at_start.positions).toEqual([securityPosition]);
  });

  it("returns no positions when both ps.acc and ps.pos only hold cash balance lines", () => {
    const statement = buildStatement(buildPositionsBlock({ acc: [cashBalanceLine], pos: [] }));

    const result = validateFreedomFinanceStatement(statement);

    expect(result.account_at_start.positions).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { findYoyPeriodPair } from "@/lib/edgar/find-yoy-period-pair";

describe("findYoyPeriodPair", () => {
  const accn = "0001-q2";

  it("pairs the current single-quarter fact with its prior-year comparative quarter sharing the same accession", () => {
    const facts = [
      { start: "2025-09-28", end: "2026-06-27", val: 300, accn, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" }, // YTD current
      { start: "2026-03-29", end: "2026-06-27", val: 100, accn, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" }, // Q current
      { start: "2024-09-29", end: "2025-06-28", val: 280, accn, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" }, // YTD prior
      { start: "2025-03-30", end: "2025-06-28", val: 90, accn, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" }, // Q prior
    ];

    const pair = findYoyPeriodPair(facts, accn);

    expect(pair?.current.val).toBe(100);
    expect(pair?.prior.val).toBe(90);
  });

  it("returns null when no facts match the accession number", () => {
    expect(findYoyPeriodPair([], accn)).toBeNull();
  });

  it("returns null when there's no comparable prior-year period anywhere (e.g. an IPO-year filing)", () => {
    const facts = [{ start: "2025-09-28", end: "2026-06-27", val: 300, accn, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" }];

    expect(findYoyPeriodPair(facts, accn)).toBeNull();
  });

  it("finds the prior-year comparative in a different accession number (annual reports that don't restate the prior year alongside the current one)", () => {
    const facts = [
      { start: "2023-01-01", end: "2023-12-31", val: 100, accn: "prior-accn", fy: 2023, fp: "FY", form: "20-F", filed: "2024-04-01" },
      { start: "2024-01-01", end: "2024-12-31", val: 125, accn, fy: 2024, fp: "FY", form: "20-F", filed: "2025-04-01" },
    ];

    const pair = findYoyPeriodPair(facts, accn);

    expect(pair?.current.val).toBe(125);
    expect(pair?.prior.val).toBe(100);
    expect(pair?.prior.accn).toBe("prior-accn");
  });

  it("pairs instant (balance-sheet) facts by end date alone, with no duration to match", () => {
    const facts = [
      { end: "2024-09-28", val: 900, accn, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" },
      { end: "2025-06-28", val: 950, accn, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" },
      { end: "2026-06-27", val: 1000, accn, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" },
    ];

    const pair = findYoyPeriodPair(facts, accn);

    expect(pair?.current.val).toBe(1000);
    expect(pair?.prior.val).toBe(950);
  });

  it("does not pair an instant fact with a duration fact even if the end dates line up", () => {
    const facts = [
      { end: "2026-06-27", val: 1000, accn, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" }, // instant, current
      { start: "2025-03-30", end: "2025-06-28", val: 90, accn, fy: 2026, fp: "Q3", form: "10-Q", filed: "2026-07-31" }, // duration, ~1yr earlier
    ];

    expect(findYoyPeriodPair(facts, accn)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { toDate, toNumber } from "@/lib/import/parsers/freedom-finance/normalize";

describe("toNumber", () => {
  it("passes through a number", () => {
    expect(toNumber(542.04)).toBe(542.04);
  });

  it("parses a numeric string", () => {
    expect(toNumber("5.00000000")).toBe(5);
  });

  it("throws for a non-numeric string", () => {
    expect(() => toNumber("not-a-number")).toThrow(/expected a numeric value/);
  });
});

describe("toDate", () => {
  it("parses a broker datetime with a space separator", () => {
    const date = toDate("2026-07-14 11:42:25");

    expect(date.toISOString()).toBe("2026-07-14T11:42:25.000Z");
  });

  it("parses a date-only string", () => {
    const date = toDate("2026-07-14");

    expect(date.toISOString()).toBe("2026-07-14T00:00:00.000Z");
  });

  it("throws for an unparseable date", () => {
    expect(() => toDate("not-a-date")).toThrow(/unparseable date/);
  });
});

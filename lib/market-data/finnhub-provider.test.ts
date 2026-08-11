import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFinnhubProvider, toFinnhubSymbol } from "@/lib/market-data/finnhub-provider";

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);

describe("toFinnhubSymbol", () => {
  it("strips the Freedom Finance .US suffix", () => {
    expect(toFinnhubSymbol("TSM.US")).toBe("TSM");
  });

  it("passes through a non-.US suffix unchanged (unconfirmed against real data)", () => {
    expect(toFinnhubSymbol("RY.TO")).toBe("RY.TO");
  });

  it("passes through a ticker with no suffix unchanged", () => {
    expect(toFinnhubSymbol("AAPL")).toBe("AAPL");
  });
});

describe("createFinnhubProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("getQuote maps a successful response and strips the .US suffix in the request URL", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ c: 404.25, h: 0, l: 0, o: 0, pc: 0, t: 1785634799 }));
    const provider = createFinnhubProvider("test-key");

    const quote = await provider.getQuote("TSM.US");

    expect(quote).toEqual({ price: 404.25, asOf: new Date(1785634799 * 1000) });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("symbol=TSM");
    expect(url).not.toContain("symbol=TSM.US");
    expect(url).toContain("token=test-key");
  });

  it("getQuote throws when Finnhub returns an empty quote (c:0, t:0 — unrecognized symbol)", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ c: 0, h: 0, l: 0, o: 0, pc: 0, t: 0 }));
    const provider = createFinnhubProvider("test-key");

    await expect(provider.getQuote("NOPE.US")).rejects.toThrow(/no quote data/);
  });

  it("getQuote throws when the HTTP response is not ok", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({}, false, 429));
    const provider = createFinnhubProvider("test-key");

    await expect(provider.getQuote("TSM.US")).rejects.toThrow(/status 429/);
  });

  it("getFxRate returns the rate for the requested quote currency", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ base: "EUR", quote: { USD: 1.08, UAH: 45.2 } }));
    const provider = createFinnhubProvider("test-key");

    const rate = await provider.getFxRate("EUR", "USD");

    expect(rate).toBe(1.08);
  });

  it("getFxRate throws when the quote currency isn't in the response", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ base: "EUR", quote: { UAH: 45.2 } }));
    const provider = createFinnhubProvider("test-key");

    await expect(provider.getFxRate("EUR", "USD")).rejects.toThrow(/no forex rate/);
  });

  it("getMetric returns null (fundamentals are Phase 5 scope, not implemented)", async () => {
    const provider = createFinnhubProvider("test-key");

    await expect(provider.getMetric?.("TSM.US", "roic")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTwelveDataProvider, toTwelveDataSymbol } from "@/lib/market-data/twelve-data-provider";

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);

describe("toTwelveDataSymbol", () => {
  it("strips the Freedom Finance .US suffix", () => {
    expect(toTwelveDataSymbol("TSM.US")).toBe("TSM");
  });

  it("passes through a non-.US suffix unchanged (unconfirmed against real data)", () => {
    expect(toTwelveDataSymbol("RY.TO")).toBe("RY.TO");
  });

  it("passes through a ticker with no suffix unchanged", () => {
    expect(toTwelveDataSymbol("AAPL")).toBe("AAPL");
  });
});

describe("createTwelveDataProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("getQuote maps a successful response and strips the .US suffix in the request URL", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ close: "404.25", timestamp: 1785634799 }));
    const provider = createTwelveDataProvider("test-key");

    const quote = await provider.getQuote("TSM.US");

    expect(quote).toEqual({ price: 404.25, asOf: new Date(1785634799 * 1000) });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("symbol=TSM");
    expect(url).not.toContain("symbol=TSM.US");
    expect(url).toContain("apikey=test-key");
  });

  it("getQuote throws when Twelve Data returns no close/timestamp (unrecognized symbol)", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ message: "symbol not found" }));
    const provider = createTwelveDataProvider("test-key");

    await expect(provider.getQuote("NOPE.US")).rejects.toThrow(/no quote data/);
  });

  it("getQuote throws when the HTTP response is not ok", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({}, false, 429));
    const provider = createTwelveDataProvider("test-key");

    await expect(provider.getQuote("TSM.US")).rejects.toThrow(/status 429/);
  });

  it("getFxRate returns the rate for the requested currency pair", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ rate: 1.08 }));
    const provider = createTwelveDataProvider("test-key");

    const rate = await provider.getFxRate("EUR", "USD");

    expect(rate).toBe(1.08);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain(`symbol=${encodeURIComponent("EUR/USD")}`);
  });

  it("getFxRate throws when the response has no rate", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ message: "invalid pair" }));
    const provider = createTwelveDataProvider("test-key");

    await expect(provider.getFxRate("EUR", "USD")).rejects.toThrow(/no forex rate/);
  });
});

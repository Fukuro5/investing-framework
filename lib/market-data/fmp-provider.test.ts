import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFmpProvider, toFmpSymbol } from "@/lib/market-data/fmp-provider";

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);

describe("toFmpSymbol", () => {
  it("strips the Freedom Finance .US suffix", () => {
    expect(toFmpSymbol("TSM.US")).toBe("TSM");
  });

  it("passes through a ticker with no suffix unchanged", () => {
    expect(toFmpSymbol("AAPL")).toBe("AAPL");
  });
});

describe("createFmpProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("returns null for an unmapped metric key without calling the API", async () => {
    const provider = createFmpProvider("test-key");

    await expect(provider.getMetric("TSM.US", "convexity")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps peRatio from the ratios-ttm endpoint, using the start of today as the asOfDate", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse([{ priceToEarningsRatioTTM: 28.4 }]));
    const provider = createFmpProvider("test-key");

    const result = await provider.getMetric("TSM.US", "peRatio");
    const now = new Date();

    expect(result?.value).toBe(28.4);
    expect(result?.asOfDate).toEqual(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/ratios-ttm?symbol=TSM&");
    expect(url).not.toContain("symbol=TSM.US");
  });

  it("maps dividendYield from the ratios-ttm endpoint", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse([{ dividendYieldTTM: 0.012 }]));
    const provider = createFmpProvider("test-key");

    const result = await provider.getMetric("TSM.US", "dividendYield");

    expect(result?.value).toBe(0.012);
  });

  it("returns null when the ratios-ttm field is missing from the response", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse([{}]));
    const provider = createFmpProvider("test-key");

    await expect(provider.getMetric("TSM.US", "peRatio")).resolves.toBeNull();
  });

  it("maps roic from the key-metrics-ttm endpoint", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse([{ returnOnInvestedCapitalTTM: 14.7 }]));
    const provider = createFmpProvider("test-key");

    const result = await provider.getMetric("TSM.US", "roic");

    expect(result?.value).toBe(14.7);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/key-metrics-ttm?symbol=TSM&");
  });

  it("returns null when the key-metrics-ttm response array is empty", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse([]));
    const provider = createFmpProvider("test-key");

    await expect(provider.getMetric("TSM.US", "roic")).resolves.toBeNull();
  });

  it("throws when the HTTP response is not ok", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({}, false, 429));
    const provider = createFmpProvider("test-key");

    await expect(provider.getMetric("TSM.US", "roic")).rejects.toThrow(/status 429/);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfiguredProvider, MissingApiKeyError } from "@/lib/market-data/get-configured-provider";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getConfiguredProvider", () => {
  it("throws MissingApiKeyError when TWELVE_DATA_API_KEY is not set", () => {
    vi.stubEnv("TWELVE_DATA_API_KEY", "");
    vi.stubEnv("FMP_API_KEY", "test-key");

    expect(() => getConfiguredProvider()).toThrow(MissingApiKeyError);
  });

  it("throws MissingApiKeyError when FMP_API_KEY is not set", () => {
    vi.stubEnv("TWELVE_DATA_API_KEY", "test-key");
    vi.stubEnv("FMP_API_KEY", "");

    expect(() => getConfiguredProvider()).toThrow(MissingApiKeyError);
  });

  it("returns a provider implementing getQuote, getFxRate, and getMetric when both keys are set", () => {
    vi.stubEnv("TWELVE_DATA_API_KEY", "test-key");
    vi.stubEnv("FMP_API_KEY", "test-key");

    const provider = getConfiguredProvider();

    expect(typeof provider.getQuote).toBe("function");
    expect(typeof provider.getFxRate).toBe("function");
    expect(typeof provider.getMetric).toBe("function");
  });
});

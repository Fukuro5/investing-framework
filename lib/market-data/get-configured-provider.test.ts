import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfiguredProvider, MissingApiKeyError } from "@/lib/market-data/get-configured-provider";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getConfiguredProvider", () => {
  it("throws MissingApiKeyError when FINNHUB_API_KEY is not set", () => {
    vi.stubEnv("FINNHUB_API_KEY", "");

    expect(() => getConfiguredProvider()).toThrow(MissingApiKeyError);
  });

  it("returns a provider implementing getQuote and getFxRate when FINNHUB_API_KEY is set", () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-key");

    const provider = getConfiguredProvider();

    expect(typeof provider.getQuote).toBe("function");
    expect(typeof provider.getFxRate).toBe("function");
  });
});

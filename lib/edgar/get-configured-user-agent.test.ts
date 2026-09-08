import { afterEach, describe, expect, it, vi } from "vitest";
import { EdgarError } from "@/lib/edgar/errors";
import { getConfiguredUserAgent } from "@/lib/edgar/get-configured-user-agent";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getConfiguredUserAgent", () => {
  it("throws an EdgarError when SEC_EDGAR_USER_AGENT is not set", () => {
    vi.stubEnv("SEC_EDGAR_USER_AGENT", "");

    expect(() => getConfiguredUserAgent()).toThrow(EdgarError);
  });

  it("returns the configured user agent string", () => {
    vi.stubEnv("SEC_EDGAR_USER_AGENT", "investing-framework test@example.com");

    expect(getConfiguredUserAgent()).toBe("investing-framework test@example.com");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { AiError } from "@/lib/ai/errors";

// The real OpenAI SDK refuses to construct in a browser-like environment
// (jsdom, in tests) without dangerouslyAllowBrowser — a safety check we
// want to keep in production code, so the SDK is mocked here rather than
// worked around in lib/ai/openai-provider.ts.
vi.mock("openai", () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(function MockOpenAI() {
    return { chat: { completions: { create: vi.fn() } } };
  }),
}));

const { getConfiguredAiProvider } = await import("@/lib/ai/get-configured-ai-provider");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getConfiguredAiProvider", () => {
  it("throws AiError when OPENAI_API_KEY is not set", () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    expect(() => getConfiguredAiProvider()).toThrow(AiError);
  });

  it("returns a provider implementing assessThesis when OPENAI_API_KEY is set", () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");

    const provider = getConfiguredAiProvider();

    expect(typeof provider.assessThesis).toBe("function");
  });
});

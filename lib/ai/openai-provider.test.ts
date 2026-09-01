import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiError } from "@/lib/ai/errors";

const createMock = vi.fn();

vi.mock("openai", () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(function MockOpenAI() {
    return { chat: { completions: { create: createMock } } };
  }),
}));

const { createOpenAiProvider } = await import("@/lib/ai/openai-provider");

const chatResponse = (content: string) => ({ choices: [{ message: { content } }] });

describe("createOpenAiProvider", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("returns a parsed thesis assessment from a valid JSON response", async () => {
    createMock.mockResolvedValue(chatResponse(JSON.stringify({ verdict: "holding", explanation: "Margins still expanding." })));

    const provider = createOpenAiProvider("test-key");
    const assessment = await provider.assessThesis({ thesisContent: "Durable moat.", filingText: "Revenue grew 20%." });

    expect(assessment).toEqual({ verdict: "holding", explanation: "Margins still expanding." });
  });

  it("throws AiError with code requestFailed when the SDK call rejects", async () => {
    createMock.mockRejectedValue(new Error("network down"));

    const provider = createOpenAiProvider("test-key");

    await expect(provider.assessThesis({ thesisContent: "x", filingText: "y" })).rejects.toMatchObject({
      code: "requestFailed",
    });
  });

  it("throws AiError with code invalidResponse when content is missing", async () => {
    createMock.mockResolvedValue({ choices: [{ message: {} }] });

    const provider = createOpenAiProvider("test-key");

    await expect(provider.assessThesis({ thesisContent: "x", filingText: "y" })).rejects.toBeInstanceOf(AiError);
  });

  it("throws AiError with code invalidResponse when the choice has no message at all", async () => {
    createMock.mockResolvedValue({ choices: [{}] });

    const provider = createOpenAiProvider("test-key");

    await expect(provider.assessThesis({ thesisContent: "x", filingText: "y" })).rejects.toMatchObject({
      code: "invalidResponse",
    });
  });

  it("throws AiError with code invalidResponse when content is not valid JSON", async () => {
    createMock.mockResolvedValue(chatResponse("not json"));

    const provider = createOpenAiProvider("test-key");

    await expect(provider.assessThesis({ thesisContent: "x", filingText: "y" })).rejects.toMatchObject({
      code: "invalidResponse",
    });
  });

  it("throws AiError with code invalidResponse when the verdict is unrecognized", async () => {
    createMock.mockResolvedValue(chatResponse(JSON.stringify({ verdict: "uncertain", explanation: "..." })));

    const provider = createOpenAiProvider("test-key");

    await expect(provider.assessThesis({ thesisContent: "x", filingText: "y" })).rejects.toMatchObject({
      code: "invalidResponse",
    });
  });
});

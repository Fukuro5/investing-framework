import { AiError } from "@/lib/ai/errors";
import { createOpenAiProvider } from "@/lib/ai/openai-provider";
import type { AiProvider } from "@/lib/ai/types";

// Reads OPENAI_API_KEY lazily (only when a thesis check is actually
// triggered) — mirrors getConfiguredProvider in
// lib/market-data/get-configured-provider.ts.
export const getConfiguredAiProvider = (): AiProvider => {
  const { OPENAI_API_KEY } = process.env;

  if (!OPENAI_API_KEY) {
    throw new AiError("missingApiKey", "OPENAI_API_KEY is not set");
  }

  return createOpenAiProvider(OPENAI_API_KEY);
};

import OpenAI from "openai";
import { OPENAI_MODEL, THESIS_ASSESSMENT_JSON_SCHEMA, THESIS_ASSESSMENT_SYSTEM_PROMPT } from "@/lib/ai/consts";
import { AiError } from "@/lib/ai/errors";
import { isThesisVerdict, type AiProvider, type ThesisAssessment, type ThesisAssessmentInput } from "@/lib/ai/types";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const parseAssessment = (content: string | null | undefined): ThesisAssessment => {
  if (!content) {
    throw new AiError("invalidResponse", "OpenAI response had no message content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AiError("invalidResponse", "OpenAI response content was not valid JSON");
  }

  if (
    !isRecord(parsed) ||
    typeof parsed.verdict !== "string" ||
    !isThesisVerdict(parsed.verdict) ||
    typeof parsed.explanation !== "string"
  ) {
    throw new AiError("invalidResponse", "OpenAI response did not match the expected thesis assessment shape");
  }

  return { verdict: parsed.verdict, explanation: parsed.explanation };
};

// Factory function (not a class) — mirrors createFinnhubProvider in
// lib/market-data/finnhub-provider.ts.
export const createOpenAiProvider = (apiKey: string): AiProvider => {
  const client = new OpenAI({ apiKey });

  return {
    assessThesis: async ({ thesisContent, filingText }: ThesisAssessmentInput): Promise<ThesisAssessment> => {
      let response;
      try {
        response = await client.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [
            { role: "system", content: THESIS_ASSESSMENT_SYSTEM_PROMPT },
            { role: "user", content: `Investment thesis:\n${thesisContent}\n\nLatest SEC filing text:\n${filingText}` },
          ],
          response_format: { type: "json_schema", json_schema: THESIS_ASSESSMENT_JSON_SCHEMA },
        });
      } catch (error) {
        if (error instanceof AiError) {
          throw error;
        }
        throw new AiError("requestFailed", error instanceof Error ? error.message : "OpenAI request failed");
      }

      return parseAssessment(response.choices[0]?.message?.content);
    },
  };
};

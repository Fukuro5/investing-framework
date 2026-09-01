import { THESIS_VERDICTS } from "@/lib/ai/types";

// PLANNING.md §1 Phase 4: OpenAI, model "gpt-5.6-luna" — provider/model
// choice finalized when this phase started (previously deliberately open,
// see PLANNING.md §9/§10).
export const OPENAI_MODEL = "gpt-5.6-luna";

export const THESIS_ASSESSMENT_SYSTEM_PROMPT =
  "You are assessing whether an investor's written thesis for a company still holds, given the company's " +
  'newest SEC filing. Respond with a verdict — "holding" (the thesis still holds), "partiallyWeakening" ' +
  '(the thesis is partially weakening), or "broken" (the thesis is broken) — plus a short explanation ' +
  "grounded in specifics from the filing text.";

// json_schema response_format for the Chat Completions API — a structured
// verdict + explanation, not free text to parse.
export const THESIS_ASSESSMENT_JSON_SCHEMA = {
  name: "thesis_assessment",
  strict: true,
  schema: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: THESIS_VERDICTS },
      explanation: { type: "string" },
    },
    required: ["verdict", "explanation"],
    additionalProperties: false,
  },
} as const;

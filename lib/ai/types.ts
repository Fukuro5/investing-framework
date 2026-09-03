// Mirrors PLANNING.md §1 Phase 4's three-way verdict: "thesis still holds,
// is partially weakening, or is broken."
export const THESIS_VERDICTS = ["holding", "partiallyWeakening", "broken"] as const;
export type ThesisVerdict = (typeof THESIS_VERDICTS)[number];

export const isThesisVerdict = (value: string): value is ThesisVerdict => (THESIS_VERDICTS as readonly string[]).includes(value);

export interface ThesisAssessmentInput {
  thesisContent: string;
  filingText: string;
}

export interface ThesisAssessment {
  verdict: ThesisVerdict;
  explanation: string;
}

// Swappable AI provider interface (mirrors MarketDataProvider in
// lib/market-data/types.ts) — Phase 4 uses OpenAI, but nothing calling
// assessThesis needs to change if that choice is revisited later.
export interface AiProvider {
  assessThesis(input: ThesisAssessmentInput): Promise<ThesisAssessment>;
}

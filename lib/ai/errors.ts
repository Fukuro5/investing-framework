export type AiErrorCode = "missingApiKey" | "requestFailed" | "invalidResponse";

// Mirrors lib/edgar/errors.ts — `message` is for logs/tests, `code` is what
// callers branch on (assess-thesis-against-filing.ts never lets this
// escape as a thrown error; it's converted to a ThesisCheckResult value).
export class AiError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

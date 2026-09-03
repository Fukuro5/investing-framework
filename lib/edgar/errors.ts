export type EdgarErrorCode =
  | "missingUserAgent"
  | "instrumentNotFound"
  | "cikNotFound"
  | "noTrackedFilingFound"
  | "financialsUnavailable";

// Mirrors lib/frameworks/errors.ts — `message` is for logs/tests, `code` +
// `params` are what Server Actions use to look up a translated, user-facing
// message via `errors.edgar.*`.
export class EdgarError extends Error {
  readonly code: EdgarErrorCode;
  readonly params: Record<string, string | number>;

  constructor(code: EdgarErrorCode, message: string, params: Record<string, string | number> = {}) {
    super(message);
    this.code = code;
    this.params = params;
  }
}

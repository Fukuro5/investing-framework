export type MetricErrorCode = "metricKeyRequired" | "metricValueMustBeNumber" | "metricAsOfDateInvalid";

// Mirrors lib/frameworks/errors.ts — `message` is for logs/tests, `code` is
// what Server Actions use to look up a translated, user-facing message via
// `errors.metrics.*`.
export class MetricError extends Error {
  readonly code: MetricErrorCode;

  constructor(code: MetricErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

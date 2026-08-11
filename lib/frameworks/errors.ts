export type FrameworkErrorCode =
  | "frameworkNameRequired"
  | "frameworkNameTaken"
  | "groupNameRequired"
  | "groupAllocationOutOfRange"
  | "groupMinGreaterThanMax"
  | "groupNameTaken"
  | "groupHasAssignments"
  | "groupsNotFullyAllocated"
  | "groupFieldMustBeNumber";

// `message` is for logs/tests (readable, stable-enough to assert on);
// `code` + `params` are what Server Actions use to look up a translated,
// user-facing message via `errors.frameworks.*` — see actions.ts files.
export class FrameworkError extends Error {
  readonly code: FrameworkErrorCode;
  readonly params: Record<string, string | number>;

  constructor(code: FrameworkErrorCode, message: string, params: Record<string, string | number> = {}) {
    super(message);
    this.code = code;
    this.params = params;
  }
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const assertObject = (value: unknown, path: string): Record<string, unknown> => {
  if (!isObject(value)) {
    throw new Error(`Freedom Finance statement: expected an object at "${path}"`);
  }

  return value;
};

export const assertArray = (value: unknown, path: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error(`Freedom Finance statement: expected an array at "${path}"`);
  }

  return value;
};

export const assertString = (value: unknown, path: string): string => {
  if (typeof value !== "string") {
    throw new Error(`Freedom Finance statement: expected a string at "${path}"`);
  }

  return value;
};

export const assertStringOrNumber = (value: unknown, path: string): string | number => {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`Freedom Finance statement: expected a string or number at "${path}"`);
  }

  return value;
};

export const assertStringOrNumberOrNull = (value: unknown, path: string): string | number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return assertStringOrNumber(value, path);
};

export const assertStringOrNull = (value: unknown, path: string): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return assertString(value, path);
};

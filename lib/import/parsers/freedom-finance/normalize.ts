export const toNumber = (value: string | number): number => {
  const numeric = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(numeric)) {
    throw new Error(`Freedom Finance statement: expected a numeric value, got "${value}"`);
  }

  return numeric;
};

// Freedom Finance timestamps come as "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD" —
// neither is ISO 8601. A date-only string is already parsed as UTC per the
// ISO 8601 spec, but a date-time string without a timezone designator is
// parsed in the *host machine's* local time — appending "Z" pins it to UTC
// so parsing doesn't vary depending on where this app happens to run.
export const toDate = (value: string): Date => {
  const isoLike = value.includes(" ") ? `${value.replace(" ", "T")}Z` : value;
  const date = new Date(isoLike);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Freedom Finance statement: unparseable date "${value}"`);
  }

  return date;
};

import { EdgarError } from "@/lib/edgar/errors";

// SEC EDGAR requires no API key, just a descriptive User-Agent header (app
// name + contact email) — read lazily since checks are manual/on-demand,
// never on every page load (PLANNING.md §1 Phase 3).
export const getConfiguredUserAgent = (): string => {
  const { SEC_EDGAR_USER_AGENT } = process.env;

  if (!SEC_EDGAR_USER_AGENT) {
    throw new EdgarError("missingUserAgent", "SEC_EDGAR_USER_AGENT is not set");
  }

  return SEC_EDGAR_USER_AGENT;
};

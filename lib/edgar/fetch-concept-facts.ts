import { EDGAR_DATA_BASE_URL } from "@/lib/edgar/consts";
import { EdgarHttpError, getEdgarJson } from "@/lib/edgar/edgar-client";
import type { CompanyConceptResponse, ConceptCandidate, XbrlFact } from "@/lib/edgar/xbrl-types";

const DEFAULT_UNIT = "USD";
const NOT_FOUND_STATUS = 404;

// A missing tag/taxonomy combination 404s — treated as "no data for this
// candidate" so callers can fall through to the next candidate (e.g. an
// ifrs-full tag for a foreign private issuer) rather than aborting. Any
// other failure (network/rate-limit/5xx) rethrows so the check fails loudly
// instead of being misread as "no data".
export const fetchConceptFacts = async (cik: string, candidate: ConceptCandidate, userAgent: string): Promise<XbrlFact[]> => {
  try {
    const url = `${EDGAR_DATA_BASE_URL}/api/xbrl/companyconcept/CIK${cik}/${candidate.taxonomy}/${candidate.tag}.json`;
    const response = await getEdgarJson<CompanyConceptResponse>(url, userAgent);
    return response.units[candidate.unit ?? DEFAULT_UNIT] ?? [];
  } catch (error) {
    if (error instanceof EdgarHttpError && error.status === NOT_FOUND_STATUS) {
      return [];
    }
    throw error;
  }
};

import { EDGAR_DATA_BASE_URL, TRACKED_FORM_TYPES } from "@/lib/edgar/consts";
import { getEdgarJson } from "@/lib/edgar/edgar-client";

export interface TrackedFiling {
  form: string;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string;
}

interface SubmissionsRecentFilings {
  form: string[];
  filingDate: string[];
  accessionNumber: string[];
  primaryDocument: string[];
}

interface SubmissionsResponse {
  filings: {
    recent: SubmissionsRecentFilings;
  };
}

const isTrackedFormType = (form: string): form is (typeof TRACKED_FORM_TYPES)[number] =>
  (TRACKED_FORM_TYPES as readonly string[]).includes(form);

// EDGAR's submissions API returns filings as several equal-length parallel
// arrays rather than an array of objects — zip them into rows here so the
// rest of the codebase never has to deal with that shape.
const zipRecentFilings = (recent: SubmissionsRecentFilings): TrackedFiling[] =>
  recent.form.map((form, index) => ({
    form,
    filingDate: recent.filingDate[index],
    accessionNumber: recent.accessionNumber[index],
    primaryDocument: recent.primaryDocument[index],
  }));

// The most recent tracked filing (10-K/10-Q/20-F) — the filing types
// carrying the financial statements the trend check (§1 Phase 3a) and
// filing text (§1 Phase 3b) need. Other filing types (8-K, proxy, ...) are
// ignored.
export const getLatestTrackedFiling = async (cik: string, userAgent: string): Promise<TrackedFiling | null> => {
  const url = `${EDGAR_DATA_BASE_URL}/submissions/CIK${cik}.json`;
  const submissions = await getEdgarJson<SubmissionsResponse>(url, userAgent);
  const tracked = zipRecentFilings(submissions.filings.recent).filter((filing) => isTrackedFormType(filing.form));

  if (tracked.length === 0) {
    return null;
  }

  return tracked.reduce((latest, filing) => (filing.filingDate > latest.filingDate ? filing : latest));
};

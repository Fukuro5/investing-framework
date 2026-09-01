// A duration fact has start+end (income/cash-flow statement line items,
// e.g. revenue over a quarter); an instant fact has only end (balance-sheet
// line items, e.g. total equity as of a date) — see find-yoy-period-pair.ts.
export interface XbrlFact {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy: number | null;
  fp: string | null;
  form: string;
  filed: string;
  frame?: string;
}

export interface CompanyConceptResponse {
  units: Record<string, XbrlFact[] | undefined>;
}

// EDGAR's `companyconcept` endpoint is namespaced by taxonomy — us-gaap for
// domestic filers, ifrs-full for foreign private issuers reporting under
// IFRS (PLANNING.md §1 Phase 3a's 20-F support). `unit` defaults to "USD"
// (e.g. per-share figures like diluted EPS use "USD/shares" instead).
export interface ConceptCandidate {
  taxonomy: string;
  tag: string;
  unit?: string;
}

import { EDGAR_DATA_BASE_URL, NET_INCOME_TAG, REVENUE_TAG_CANDIDATES, TREND_MOVE_THRESHOLD_PERCENT } from "@/lib/edgar/consts";
import { getEdgarJson } from "@/lib/edgar/edgar-client";
import { EdgarError } from "@/lib/edgar/errors";
import type { TrackedFiling } from "@/lib/edgar/get-latest-tracked-filing";

interface XbrlFact {
  start: string;
  end: string;
  val: number;
  accn: string;
  fy: number;
  fp: string;
  form: string;
  filed: string;
  frame?: string;
}

interface CompanyConceptResponse {
  units: { USD?: XbrlFact[] };
}

export type FinancialsTrendVerdict = "improving" | "flat" | "deteriorating";

export interface FinancialsTrendResult {
  verdict: FinancialsTrendVerdict;
  value: number;
  asOfDate: Date;
}

// A verdict maps to a signed number so it slots into MetricValue.value and
// stays usable by ">"/"<" metric-rule operators (PLANNING.md §1 Phase 3a).
export const TREND_VERDICT_VALUES: Record<FinancialsTrendVerdict, number> = { improving: 1, flat: 0, deteriorating: -1 };

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TARGET_YEAR_GAP_DAYS = 365;
const YEAR_GAP_TOLERANCE_DAYS = 30;
const DURATION_TOLERANCE_DAYS = 20;

const daysBetween = (laterDate: string, earlierDate: string): number =>
  Math.round((new Date(laterDate).getTime() - new Date(earlierDate).getTime()) / MS_PER_DAY);

const durationDays = (fact: XbrlFact): number => daysBetween(fact.end, fact.start);

// One filing (accession number) reports several overlapping periods for the
// same tag — e.g. a 10-Q includes the current quarter, the prior-year
// comparative quarter, and both quarters' year-to-date cumulative totals,
// all sharing the same accn. "Same period YoY" (PLANNING.md §1 Phase 3a)
// means the single-quarter (or single-year, for a 10-K) pair, not the
// cumulative ones — picked as the shortest-duration fact ending on the
// filing's latest reported date, paired with the fact of matching duration
// ending closest to exactly one year earlier.
export const findYoyPeriodPair = (facts: XbrlFact[], accessionNumber: string): { current: XbrlFact; prior: XbrlFact } | null => {
  const filingFacts = facts.filter((fact) => fact.accn === accessionNumber);

  if (filingFacts.length === 0) {
    return null;
  }

  const latestEnd = filingFacts.reduce((latest, fact) => (fact.end > latest ? fact.end : latest), filingFacts[0].end);
  const currentCandidates = filingFacts.filter((fact) => fact.end === latestEnd);
  const current = currentCandidates.reduce((shortest, fact) => (durationDays(fact) < durationDays(shortest) ? fact : shortest));
  const currentDuration = durationDays(current);

  const priorCandidates = filingFacts.filter(
    (fact) =>
      fact !== current &&
      Math.abs(durationDays(fact) - currentDuration) <= DURATION_TOLERANCE_DAYS &&
      Math.abs(daysBetween(current.end, fact.end) - TARGET_YEAR_GAP_DAYS) <= YEAR_GAP_TOLERANCE_DAYS,
  );

  if (priorCandidates.length === 0) {
    return null;
  }

  const prior = priorCandidates.reduce((best, fact) =>
    Math.abs(daysBetween(current.end, fact.end) - TARGET_YEAR_GAP_DAYS) < Math.abs(daysBetween(current.end, best.end) - TARGET_YEAR_GAP_DAYS)
      ? fact
      : best,
  );

  return { current, prior };
};

type LineItemDirection = "up" | "down" | "flat";

const classifyChange = (current: number, prior: number): LineItemDirection => {
  const change = (current - prior) / Math.abs(prior);
  const threshold = TREND_MOVE_THRESHOLD_PERCENT / 100;

  if (change >= threshold) {
    return "up";
  }
  if (change <= -threshold) {
    return "down";
  }
  return "flat";
};

const fetchConceptFacts = async (cik: string, tag: string, userAgent: string): Promise<XbrlFact[]> => {
  try {
    const url = `${EDGAR_DATA_BASE_URL}/api/xbrl/companyconcept/CIK${cik}/us-gaap/${tag}.json`;
    const response = await getEdgarJson<CompanyConceptResponse>(url, userAgent);
    return response.units.USD ?? [];
  } catch {
    return [];
  }
};

interface LineItemResult {
  direction: LineItemDirection;
  periodEnd: string;
}

interface ResolveLineItemDirectionParams {
  cik: string;
  tags: readonly string[];
  accessionNumber: string;
  userAgent: string;
}

// Tries each candidate tag in order (only relevant for revenue, whose XBRL
// tag varies by company — see REVENUE_TAG_CANDIDATES) until one has a
// comparable YoY pair for this exact filing.
const resolveLineItemDirection = async ({
  cik,
  tags,
  accessionNumber,
  userAgent,
}: ResolveLineItemDirectionParams): Promise<LineItemResult | null> => {
  for (const tag of tags) {
    const facts = await fetchConceptFacts(cik, tag, userAgent);
    const pair = findYoyPeriodPair(facts, accessionNumber);

    if (pair) {
      return { direction: classifyChange(pair.current.val, pair.prior.val), periodEnd: pair.current.end };
    }
  }

  return null;
};

// A single composite verdict from a small fixed set of core line items
// (revenue, net income) — not a per-metric breakdown (PLANNING.md §1 Phase
// 3a/§9). No raw financial figures are persisted by the caller, only this
// verdict.
export const computeFinancialsTrend = async (cik: string, filing: TrackedFiling, userAgent: string): Promise<FinancialsTrendResult> => {
  const [revenue, netIncome] = await Promise.all([
    resolveLineItemDirection({ cik, tags: REVENUE_TAG_CANDIDATES, accessionNumber: filing.accessionNumber, userAgent }),
    resolveLineItemDirection({ cik, tags: [NET_INCOME_TAG], accessionNumber: filing.accessionNumber, userAgent }),
  ]);

  if (!revenue || !netIncome) {
    throw new EdgarError(
      "financialsUnavailable",
      `Could not locate comparable revenue/net income periods for accession "${filing.accessionNumber}"`,
    );
  }

  const verdict: FinancialsTrendVerdict =
    revenue.direction === "up" && netIncome.direction === "up"
      ? "improving"
      : revenue.direction === "down" && netIncome.direction === "down"
        ? "deteriorating"
        : "flat";

  return { verdict, value: TREND_VERDICT_VALUES[verdict], asOfDate: new Date(revenue.periodEnd) };
};

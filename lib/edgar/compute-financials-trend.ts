import { TREND_MOVE_THRESHOLD_PERCENT } from "@/lib/edgar/consts";
import { EdgarError } from "@/lib/edgar/errors";
import { fetchConceptFacts } from "@/lib/edgar/fetch-concept-facts";
import { findYoyPeriodPair } from "@/lib/edgar/find-yoy-period-pair";
import type { TrackedFiling } from "@/lib/edgar/get-latest-tracked-filing";
import { OPTIONAL_LINE_ITEMS, REQUIRED_LINE_ITEMS, type LineItem } from "@/lib/edgar/line-items";
import type { ConceptCandidate, XbrlFact } from "@/lib/edgar/xbrl-types";

export type FinancialsTrendVerdict = "improving" | "flat" | "deteriorating";

export interface FinancialsTrendResult {
  verdict: FinancialsTrendVerdict;
  value: number;
  asOfDate: Date;
}

// A verdict maps to a signed number so it slots into MetricValue.value and
// stays usable by ">"/"<" metric-rule operators (PLANNING.md §1 Phase 3a).
export const TREND_VERDICT_VALUES: Record<FinancialsTrendVerdict, number> = { improving: 1, flat: 0, deteriorating: -1 };

type Contribution = "improving" | "deteriorating" | "flat";

interface LineItemResolution {
  contribution: Contribution;
  periodEnd: string;
}

const classifyChange = (current: number, prior: number): Contribution => {
  const change = (current - prior) / Math.abs(prior);
  const threshold = TREND_MOVE_THRESHOLD_PERCENT / 100;

  if (change >= threshold) {
    return "improving";
  }
  if (change <= -threshold) {
    return "deteriorating";
  }
  return "flat";
};

const invert = (contribution: Contribution): Contribution =>
  contribution === "improving" ? "deteriorating" : contribution === "deteriorating" ? "improving" : "flat";

interface YoyPair {
  current: XbrlFact;
  prior: XbrlFact;
}

// Tries each candidate (taxonomy/tag) in order until one has a comparable
// YoY pair for this exact filing — only relevant when a line item has more
// than one candidate (varying XBRL tags across companies/taxonomies).
const resolveConceptYoyPair = async (
  cik: string,
  candidates: readonly ConceptCandidate[],
  accessionNumber: string,
  userAgent: string,
): Promise<YoyPair | null> => {
  for (const candidate of candidates) {
    const facts = await fetchConceptFacts(cik, candidate, userAgent);
    const pair = findYoyPeriodPair(facts, accessionNumber);

    if (pair) {
      return pair;
    }
  }

  return null;
};

// Resolves one line item (PLANNING.md §1 Phase 3a's core-line-items list)
// to a contribution the majority vote can count — "improving" always means
// "good news" here, regardless of whether the underlying raw value went up
// or down (a ratio line item like debt-to-equity inverts) — plus the
// period-end date its YoY comparison is anchored to.
const resolveLineItem = async (
  cik: string,
  item: LineItem,
  accessionNumber: string,
  userAgent: string,
): Promise<LineItemResolution | null> => {
  if (item.kind === "concept") {
    const pair = await resolveConceptYoyPair(cik, item.candidates, accessionNumber, userAgent);
    return pair ? { contribution: classifyChange(pair.current.val, pair.prior.val), periodEnd: pair.current.end } : null;
  }

  if (item.kind === "difference") {
    const [basePair, subtractPair] = await Promise.all([
      resolveConceptYoyPair(cik, item.base, accessionNumber, userAgent),
      resolveConceptYoyPair(cik, item.subtract, accessionNumber, userAgent),
    ]);
    if (!basePair || !subtractPair) {
      return null;
    }
    const contribution = classifyChange(basePair.current.val - subtractPair.current.val, basePair.prior.val - subtractPair.prior.val);
    return { contribution, periodEnd: basePair.current.end };
  }

  const [numeratorPair, denominatorPair] = await Promise.all([
    resolveConceptYoyPair(cik, item.numerator, accessionNumber, userAgent),
    resolveConceptYoyPair(cik, item.denominator, accessionNumber, userAgent),
  ]);
  if (!numeratorPair || !denominatorPair) {
    return null;
  }
  const contribution = invert(
    classifyChange(numeratorPair.current.val / denominatorPair.current.val, numeratorPair.prior.val / denominatorPair.prior.val),
  );
  return { contribution, periodEnd: numeratorPair.current.end };
};

// A single composite verdict from a small set of core line items — not a
// per-metric breakdown (PLANNING.md §1 Phase 3a/§9). Revenue and net income
// are required (the check fails without them); the rest are best-effort
// additions to the majority vote, skipped when a company doesn't tag them.
// No raw financial figures are persisted by the caller, only this verdict.
export const computeFinancialsTrend = async (cik: string, filing: TrackedFiling, userAgent: string): Promise<FinancialsTrendResult> => {
  const allItems = [...REQUIRED_LINE_ITEMS, ...OPTIONAL_LINE_ITEMS];
  const resolutions = await Promise.all(allItems.map((item) => resolveLineItem(cik, item, filing.accessionNumber, userAgent)));

  const requiredResolutions = resolutions.slice(0, REQUIRED_LINE_ITEMS.length);
  if (requiredResolutions.some((resolution) => resolution === null)) {
    throw new EdgarError(
      "financialsUnavailable",
      `Could not locate comparable revenue/net income periods for accession "${filing.accessionNumber}"`,
    );
  }

  const resolved = resolutions.filter((resolution): resolution is LineItemResolution => resolution !== null);
  const improvingCount = resolved.filter((resolution) => resolution.contribution === "improving").length;
  const deterioratingCount = resolved.filter((resolution) => resolution.contribution === "deteriorating").length;

  const verdict: FinancialsTrendVerdict =
    improvingCount > deterioratingCount ? "improving" : deterioratingCount > improvingCount ? "deteriorating" : "flat";

  return { verdict, value: TREND_VERDICT_VALUES[verdict], asOfDate: new Date(resolved[0].periodEnd) };
};

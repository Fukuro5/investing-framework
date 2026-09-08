import type { XbrlFact } from "@/lib/edgar/xbrl-types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TARGET_YEAR_GAP_DAYS = 365;
const YEAR_GAP_TOLERANCE_DAYS = 30;
const DURATION_TOLERANCE_DAYS = 20;

const daysBetween = (laterDate: string, earlierDate: string): number =>
  Math.round((new Date(laterDate).getTime() - new Date(earlierDate).getTime()) / MS_PER_DAY);

// null means an instant fact (balance-sheet line items only carry `end`,
// no `start`) rather than a duration of 0.
const durationDays = (fact: XbrlFact): number | null => (fact.start ? daysBetween(fact.end, fact.start) : null);

const durationsMatch = (a: number | null, b: number | null): boolean =>
  a === null ? b === null : b !== null && Math.abs(a - b) <= DURATION_TOLERANCE_DAYS;

// One filing (accession number) reports several overlapping periods for the
// same tag — e.g. a 10-Q includes the current quarter, the prior-year
// comparative quarter, and both quarters' year-to-date cumulative totals,
// all sharing the same accn. "Same period YoY" (PLANNING.md §1 Phase 3a)
// means the single-quarter (or single-year, for a 10-K) pair, not the
// cumulative ones — picked as the shortest-duration fact ending on the
// filing's latest reported date.
//
// The prior-year comparative isn't searched only within that accn, though:
// annual reports for foreign private issuers (20-F) typically tag just the
// current year per filing, with no restated prior-year figure alongside it
// — so the match has to reach into the company's full fact history. This
// also covers balance-sheet ("instant") facts, which have no duration to
// match at all, only an end date ~365 days apart.
export const findYoyPeriodPair = (facts: XbrlFact[], accessionNumber: string): { current: XbrlFact; prior: XbrlFact } | null => {
  const filingFacts = facts.filter((fact) => fact.accn === accessionNumber);

  if (filingFacts.length === 0) {
    return null;
  }

  const latestEnd = filingFacts.reduce((latest, fact) => (fact.end > latest ? fact.end : latest), filingFacts[0].end);
  const currentCandidates = filingFacts.filter((fact) => fact.end === latestEnd);
  const current = currentCandidates.reduce((shortest, fact) =>
    (durationDays(fact) ?? 0) < (durationDays(shortest) ?? 0) ? fact : shortest,
  );
  const currentDuration = durationDays(current);

  const priorCandidates = facts.filter(
    (fact) =>
      fact !== current &&
      durationsMatch(durationDays(fact), currentDuration) &&
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

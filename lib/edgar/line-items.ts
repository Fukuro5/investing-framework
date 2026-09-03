import type { ConceptCandidate } from "@/lib/edgar/xbrl-types";

const usGaap = (tag: string, unit?: string): ConceptCandidate => ({ taxonomy: "us-gaap", tag, unit });
const ifrsFull = (tag: string, unit?: string): ConceptCandidate => ({ taxonomy: "ifrs-full", tag, unit });

interface ConceptLineItem {
  kind: "concept";
  key: string;
  candidates: readonly ConceptCandidate[];
}

// FCF = base - subtract (operating cash flow minus capex).
interface DifferenceLineItem {
  kind: "difference";
  key: string;
  base: readonly ConceptCandidate[];
  subtract: readonly ConceptCandidate[];
}

// A lower ratio is the healthier direction (e.g. debt-to-equity) — resolved
// as "improving"/"deteriorating" the opposite way from a plain concept or
// difference line item.
interface RatioLineItem {
  kind: "ratio";
  key: string;
  numerator: readonly ConceptCandidate[];
  denominator: readonly ConceptCandidate[];
}

export type LineItem = ConceptLineItem | DifferenceLineItem | RatioLineItem;

// Revenue and net income anchor the verdict — if either can't be resolved
// (see computeFinancialsTrend), the whole check fails rather than silently
// scoring off a partial/degraded set (PLANNING.md §1 Phase 3a).
export const REQUIRED_LINE_ITEMS: readonly LineItem[] = [
  {
    kind: "concept",
    key: "revenue",
    // Revenue's XBRL tag varies by company/ASC-606-adoption era, and
    // foreign private issuers (20-F) commonly report under IFRS instead of
    // US-GAAP — candidates are tried in order until one has data.
    candidates: [
      usGaap("RevenueFromContractWithCustomerExcludingAssessedTax"),
      usGaap("Revenues"),
      usGaap("SalesRevenueNet"),
      ifrsFull("Revenue"),
    ],
  },
  {
    kind: "concept",
    key: "netIncome",
    candidates: [usGaap("NetIncomeLoss"), ifrsFull("ProfitLoss")],
  },
];

// Best-effort additions to the majority vote — not every company tags all
// of these (e.g. a single-step income statement has no separate gross
// profit line), so a missing one is just skipped rather than failing the
// whole check.
export const OPTIONAL_LINE_ITEMS: readonly LineItem[] = [
  {
    kind: "concept",
    key: "operatingIncome",
    candidates: [usGaap("OperatingIncomeLoss"), ifrsFull("ProfitLossFromOperatingActivities")],
  },
  {
    kind: "concept",
    key: "grossProfit",
    candidates: [usGaap("GrossProfit"), ifrsFull("GrossProfit")],
  },
  {
    kind: "concept",
    key: "dilutedEps",
    candidates: [usGaap("EarningsPerShareDiluted", "USD/shares"), ifrsFull("DilutedEarningsLossPerShare", "USD/shares")],
  },
  {
    kind: "difference",
    key: "freeCashFlow",
    base: [
      usGaap("NetCashProvidedByUsedInOperatingActivities"),
      usGaap("NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"),
      ifrsFull("CashFlowsFromUsedInOperatingActivities"),
    ],
    subtract: [
      usGaap("PaymentsToAcquirePropertyPlantAndEquipment"),
      usGaap("PaymentsToAcquireProductiveAssets"),
      ifrsFull("PurchaseOfPropertyPlantAndEquipment"),
    ],
  },
  {
    kind: "ratio",
    // A total-liabilities-to-equity proxy — XBRL has no single universal
    // "interest-bearing debt" tag, so total liabilities is the practical,
    // near-universally-tagged stand-in for leverage here.
    key: "debtToEquity",
    numerator: [usGaap("Liabilities"), ifrsFull("Liabilities")],
    denominator: [
      usGaap("StockholdersEquity"),
      usGaap("StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"),
      ifrsFull("Equity"),
    ],
  },
];

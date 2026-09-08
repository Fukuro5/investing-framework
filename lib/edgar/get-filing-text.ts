import { convert } from "html-to-text";
import { EDGAR_WWW_BASE_URL } from "@/lib/edgar/consts";
import { getEdgarText } from "@/lib/edgar/edgar-client";
import type { TrackedFiling } from "@/lib/edgar/get-latest-tracked-filing";

// Not called anywhere yet — exposed for Phase 4 (AI thesis-vs-report
// analysis, PLANNING.md §1 Phase 4) to import once it starts. Stripping to
// plain text isn't required for an AI model to read the filing; it cuts
// token cost/context noise, since a filing's raw HTML (inline styles,
// XBRL tagging, deeply nested tables) runs several times the token count
// of the equivalent plain text for no comprehension benefit (§1 Phase 3b).
export const getFilingText = async (cik: string, filing: TrackedFiling, userAgent: string): Promise<string> => {
  const accessionNumberNoDashes = filing.accessionNumber.replace(/-/g, "");
  const url = `${EDGAR_WWW_BASE_URL}/Archives/edgar/data/${Number(cik)}/${accessionNumberNoDashes}/${filing.primaryDocument}`;
  const html = await getEdgarText(url, userAgent);

  return convert(html, { wordwrap: false });
};

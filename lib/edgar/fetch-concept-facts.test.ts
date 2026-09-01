import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchConceptFacts } from "@/lib/edgar/fetch-concept-facts";

const jsonResponse = (body: unknown, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);

describe("fetchConceptFacts", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("requests the taxonomy/tag URL and returns the default USD unit's facts", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ units: { USD: [{ end: "2026-01-01", val: 1, accn: "a", fy: 2026, fp: "FY", form: "10-K", filed: "x" }] } }));

    const facts = await fetchConceptFacts("0000320193", { taxonomy: "us-gaap", tag: "NetIncomeLoss" }, "ua");

    expect(facts).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://data.sec.gov/api/xbrl/companyconcept/CIK0000320193/us-gaap/NetIncomeLoss.json");
  });

  it("reads a non-default unit when one is specified (e.g. per-share figures)", async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({ units: { "USD/shares": [{ end: "2026-01-01", val: 6.88, accn: "a", fy: 2026, fp: "FY", form: "10-K", filed: "x" }] } }),
    );

    const facts = await fetchConceptFacts("0000320193", { taxonomy: "us-gaap", tag: "EarningsPerShareDiluted", unit: "USD/shares" }, "ua");

    expect(facts).toEqual([{ end: "2026-01-01", val: 6.88, accn: "a", fy: 2026, fp: "FY", form: "10-K", filed: "x" }]);
  });

  it("returns an empty array when the tag doesn't exist for this company (404)", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({}, false, 404));

    const facts = await fetchConceptFacts("0000320193", { taxonomy: "ifrs-full", tag: "Revenue" }, "ua");

    expect(facts).toEqual([]);
  });
});

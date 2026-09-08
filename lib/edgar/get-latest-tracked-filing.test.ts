import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLatestTrackedFiling } from "@/lib/edgar/get-latest-tracked-filing";

const jsonResponse = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

describe("getLatestTrackedFiling", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("returns the most recent 10-K/10-Q, ignoring other form types", async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({
        filings: {
          recent: {
            form: ["8-K", "10-Q", "10-K", "10-Q"],
            filingDate: ["2026-08-01", "2026-05-01", "2025-11-01", "2026-02-01"],
            accessionNumber: ["0001-8k", "0001-q2", "0001-10k", "0001-q1"],
            primaryDocument: ["a.htm", "b.htm", "c.htm", "d.htm"],
          },
        },
      }),
    );

    const filing = await getLatestTrackedFiling("0000320193", "ua");

    expect(filing).toEqual({ form: "10-Q", filingDate: "2026-05-01", accessionNumber: "0001-q2", primaryDocument: "b.htm" });
  });

  it("returns null when there are no tracked filing types", async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({
        filings: { recent: { form: ["8-K"], filingDate: ["2026-08-01"], accessionNumber: ["0001-8k"], primaryDocument: ["a.htm"] } },
      }),
    );

    const filing = await getLatestTrackedFiling("0000320193", "ua");

    expect(filing).toBeNull();
  });

  it("requests the submissions endpoint for the given CIK", async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({ filings: { recent: { form: [], filingDate: [], accessionNumber: [], primaryDocument: [] } } }),
    );

    await getLatestTrackedFiling("0000320193", "ua");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://data.sec.gov/submissions/CIK0000320193.json");
  });
});

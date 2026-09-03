import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFilingText } from "@/lib/edgar/get-filing-text";
import type { TrackedFiling } from "@/lib/edgar/get-latest-tracked-filing";

const FILING: TrackedFiling = { form: "10-Q", filingDate: "2026-07-31", accessionNumber: "0000320193-26-000020", primaryDocument: "aapl-10q.htm" };

describe("getFilingText", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("builds the filing document URL from the CIK, accession number, and primary document", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve("<p>hello</p>") });

    await getFilingText("0000320193", FILING, "ua");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.sec.gov/Archives/edgar/data/320193/000032019326000020/aapl-10q.htm");
  });

  it("strips script/style content and tags, keeping the visible text", async () => {
    const html = `
      <html>
        <head><style>.risk { color: red; }</style></head>
        <body>
          <script>trackPageView();</script>
          <h1>Item 1. Financial Statements</h1>
          <p>Net income increased year over year.</p>
        </body>
      </html>
    `;
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve(html) });

    const text = await getFilingText("0000320193", FILING, "ua");

    expect(text.toLowerCase()).toContain("item 1. financial statements");
    expect(text).toContain("Net income increased year over year.");
    expect(text).not.toContain("trackPageView");
    expect(text).not.toContain("color: red");
  });

  it("sends the User-Agent header on the document request", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve("<p>hi</p>") });

    await getFilingText("0000320193", FILING, "my-app contact@example.com");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toEqual({ "User-Agent": "my-app contact@example.com" });
  });
});

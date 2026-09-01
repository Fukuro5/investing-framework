import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEdgarJson, getEdgarText } from "@/lib/edgar/edgar-client";

describe("edgar-client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("getEdgarJson sends the User-Agent header and returns the parsed body", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ hello: "world" }) });

    const result = await getEdgarJson<{ hello: string }>("https://data.sec.gov/some/path.json", "my-app contact@example.com");

    expect(result).toEqual({ hello: "world" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://data.sec.gov/some/path.json");
    expect(init.headers).toEqual({ "User-Agent": "my-app contact@example.com" });
  });

  it("getEdgarJson throws when the response is not ok", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 });

    await expect(getEdgarJson("https://data.sec.gov/some/path.json", "ua")).rejects.toThrow(/status 403/);
  });

  it("getEdgarText sends the User-Agent header and returns the raw body text", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve("<html>hi</html>") });

    const result = await getEdgarText("https://www.sec.gov/some/doc.htm", "my-app contact@example.com");

    expect(result).toBe("<html>hi</html>");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toEqual({ "User-Agent": "my-app contact@example.com" });
  });

  it("getEdgarText throws when the response is not ok", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(getEdgarText("https://www.sec.gov/some/doc.htm", "ua")).rejects.toThrow(/status 404/);
  });
});

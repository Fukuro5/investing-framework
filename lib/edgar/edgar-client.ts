// Low-level fetch wrapper shared by every EDGAR call — SEC requires a
// descriptive User-Agent header instead of an API key (PLANNING.md §1
// Phase 3), so auth is header-based rather than Finnhub's query-param key.
const withUserAgent = (userAgent: string): HeadersInit => ({ "User-Agent": userAgent });

export const getEdgarJson = async <T>(url: string, userAgent: string): Promise<T> => {
  const response = await fetch(url, { headers: withUserAgent(userAgent) });

  if (!response.ok) {
    throw new Error(`EDGAR request failed with status ${response.status} for ${url}`);
  }

  return response.json() as Promise<T>;
};

export const getEdgarText = async (url: string, userAgent: string): Promise<string> => {
  const response = await fetch(url, { headers: withUserAgent(userAgent) });

  if (!response.ok) {
    throw new Error(`EDGAR request failed with status ${response.status} for ${url}`);
  }

  return response.text();
};

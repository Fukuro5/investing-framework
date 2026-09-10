// Low-level fetch wrapper shared by every EDGAR call — SEC requires a
// descriptive User-Agent header instead of an API key (PLANNING.md §1
// Phase 3), so auth is header-based rather than the market-data providers'
// query-param key.
const withUserAgent = (userAgent: string): HeadersInit => ({ "User-Agent": userAgent });

// Carries the HTTP status so callers can distinguish "not found" (safe to
// treat as absent data) from network/rate-limit/5xx failures (should
// propagate, not be silently swallowed).
export class EdgarHttpError extends Error {
  readonly status: number;

  constructor(status: number, url: string) {
    super(`EDGAR request failed with status ${status} for ${url}`);
    this.status = status;
  }
}

export const getEdgarJson = async <T>(url: string, userAgent: string): Promise<T> => {
  const response = await fetch(url, { headers: withUserAgent(userAgent) });

  if (!response.ok) {
    throw new EdgarHttpError(response.status, url);
  }

  return response.json() as Promise<T>;
};

export const getEdgarText = async (url: string, userAgent: string): Promise<string> => {
  const response = await fetch(url, { headers: withUserAgent(userAgent) });

  if (!response.ok) {
    throw new EdgarHttpError(response.status, url);
  }

  return response.text();
};

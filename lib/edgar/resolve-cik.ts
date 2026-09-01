import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EDGAR_WWW_BASE_URL } from "@/lib/edgar/consts";
import { getEdgarJson } from "@/lib/edgar/edgar-client";
import { EdgarError } from "@/lib/edgar/errors";

const US_SUFFIX = ".US";
const CIK_LENGTH = 10;

interface CompanyTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

type CompanyTickersResponse = Record<string, CompanyTickerEntry>;

// Mirrors lib/market-data/finnhub-provider.ts's toFinnhubSymbol — brokers
// suffix US tickers with ".US"; EDGAR's ticker file uses the bare symbol.
export const toEdgarSymbol = (ticker: string): string => (ticker.endsWith(US_SUFFIX) ? ticker.slice(0, -US_SUFFIX.length) : ticker);

const padCik = (cik: number): string => String(cik).padStart(CIK_LENGTH, "0");

// CIK is resolved once via SEC's public ticker->CIK file and cached on
// Instrument.edgarCik so it's never re-fetched (PLANNING.md §1 Phase 3).
export const resolveInstrumentCik = async (instrumentId: string, userAgent: string, db: PrismaClient = prisma): Promise<string> => {
  const instrument = await db.instrument.findUnique({ where: { id: instrumentId } });

  if (!instrument) {
    throw new EdgarError("instrumentNotFound", `Instrument "${instrumentId}" not found`);
  }

  if (instrument.edgarCik) {
    return instrument.edgarCik;
  }

  const symbol = toEdgarSymbol(instrument.ticker).toUpperCase();
  const tickers = await getEdgarJson<CompanyTickersResponse>(`${EDGAR_WWW_BASE_URL}/files/company_tickers.json`, userAgent);
  const match = Object.values(tickers).find((entry) => entry.ticker.toUpperCase() === symbol);

  if (!match) {
    throw new EdgarError("cikNotFound", `No SEC CIK found for ticker "${instrument.ticker}"`, { ticker: instrument.ticker });
  }

  const cik = padCik(match.cik_str);
  await db.instrument.update({ where: { id: instrumentId }, data: { edgarCik: cik } });

  return cik;
};

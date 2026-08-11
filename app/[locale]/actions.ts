"use server";

import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { classifyInstruments } from "@/lib/frameworks/classify-instruments";
import { getConfiguredProvider, MissingApiKeyError } from "@/lib/market-data/get-configured-provider";
import { refreshMarketData } from "@/lib/market-data/refresh-market-data";
import type { MarketDataProvider } from "@/lib/market-data/types";

export interface RefreshMarketDataState {
  status: "idle" | "success" | "error";
  updatedPriceCount?: number;
  failedPriceTickers?: string[];
  updatedFxCount?: number;
  failedFxCurrencies?: string[];
  updatedMetricCount?: number;
  failedMetrics?: string[];
  errorKey?: "missingApiKey" | "genericRefreshError";
}

// `db`/`provider` are only ever passed explicitly in tests — bound as a
// form action via useActionState, React always calls this with exactly
// (previousState, formData), so both default to the real app singletons.
export const refreshMarketDataAction = async (
  _previousState: RefreshMarketDataState,
  _formData: FormData,
  db: PrismaClient = prisma,
  provider?: MarketDataProvider,
): Promise<RefreshMarketDataState> => {
  try {
    const result = await refreshMarketData(provider ?? getConfiguredProvider(), db);

    // A price/metric refresh is an explicit evaluation trigger (PLANNING.md
    // §5) — re-classify the active framework, if any, so its groups
    // reflect what was just fetched rather than waiting for someone to
    // separately hit "Recompute".
    const activeFramework = await db.framework.findFirst({ where: { isActive: true }, select: { id: true } });
    if (activeFramework) {
      await classifyInstruments(activeFramework.id, db);
    }

    return { status: "success", ...result };
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return { status: "error", errorKey: "missingApiKey" };
    }

    return { status: "error", errorKey: "genericRefreshError" };
  }
};

"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { refreshMarketDataAction, type RefreshMarketDataState } from "@/app/[locale]/actions";

const INITIAL_STATE: RefreshMarketDataState = { status: "idle" };

export const RefreshMarketDataButton = () => {
  const t = useTranslations("dashboardPage.refresh");
  const tErrors = useTranslations("errors");
  const [state, formAction, isPending] = useActionState(refreshMarketDataAction, INITIAL_STATE);

  const failedItems = [
    ...(state.failedPriceTickers ?? []),
    ...(state.failedFxCurrencies ?? []),
    ...(state.failedMetrics ?? []),
  ];

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-2">
      <button
        type="submit"
        disabled={isPending}
        className="w-fit rounded border border-black/20 px-4 py-2 text-sm disabled:opacity-50 dark:border-white/20"
      >
        {t("button")}
      </button>
      {state.status === "success" && (
        <p className="text-sm text-green-700 dark:text-green-400">
          {t("successMessage", {
            updatedPriceCount: state.updatedPriceCount ?? 0,
            updatedFxCount: state.updatedFxCount ?? 0,
            updatedMetricCount: state.updatedMetricCount ?? 0,
          })}
        </p>
      )}
      {state.status === "success" && failedItems.length > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {t("partialFailureMessage", { failedItems: failedItems.join(", ") })}
        </p>
      )}
      {state.status === "error" && (
        <p className="text-sm text-red-700 dark:text-red-400">{tErrors(state.errorKey ?? "genericRefreshError")}</p>
      )}
    </form>
  );
};

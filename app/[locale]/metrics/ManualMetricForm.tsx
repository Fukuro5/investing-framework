"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { upsertManualMetricAction, type UpsertMetricState } from "@/app/[locale]/metrics/actions";
import { METRIC_KEYS } from "@/lib/metrics/catalog";

const INITIAL_STATE: UpsertMetricState = { status: "idle" };

interface IManualMetricFormProps {
  instrumentId: string;
}

export const ManualMetricForm = ({ instrumentId }: IManualMetricFormProps) => {
  const t = useTranslations("metricsPage");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(upsertManualMetricAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="instrumentId" value={instrumentId} />
      <label className="flex flex-col gap-1 text-sm">
        {t("metricKeyLabel")}
        <select
          name="metricKey"
          required
          defaultValue=""
          className="rounded border border-black/20 px-2 py-1 dark:border-white/20"
        >
          <option value="" disabled>
            {t("metricKeyPlaceholder")}
          </option>
          {METRIC_KEYS.map((metricKey) => (
            <option key={metricKey} value={metricKey}>
              {tCommon(`metricKeys.${metricKey}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("valueLabel")}
        <input
          type="number"
          name="value"
          required
          step="0.01"
          className="w-28 rounded border border-black/20 px-2 py-1 dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("asOfDateLabel")}
        <input type="date" name="asOfDate" required className="rounded border border-black/20 px-2 py-1 dark:border-white/20" />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {t("saveButton")}
      </button>
      {state.status === "error" && <p className="w-full text-sm text-red-700 dark:text-red-400">{state.errorMessage}</p>}
    </form>
  );
};

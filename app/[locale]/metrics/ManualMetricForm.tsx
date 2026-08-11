"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { upsertManualMetricAction, type UpsertMetricState } from "@/app/[locale]/metrics/actions";
import { SUGGESTED_METRIC_KEYS } from "@/lib/metrics/consts";

const INITIAL_STATE: UpsertMetricState = { status: "idle" };

interface IManualMetricFormProps {
  instrumentId: string;
}

export const ManualMetricForm = ({ instrumentId }: IManualMetricFormProps) => {
  const t = useTranslations("metricsPage");
  const [state, formAction, isPending] = useActionState(upsertManualMetricAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="instrumentId" value={instrumentId} />
      <label className="flex flex-col gap-1 text-sm">
        {t("metricKeyLabel")}
        <input
          type="text"
          name="metricKey"
          list={`metric-keys-${instrumentId}`}
          required
          className="w-32 rounded border border-black/20 px-2 py-1 dark:border-white/20"
        />
        <datalist id={`metric-keys-${instrumentId}`}>
          {SUGGESTED_METRIC_KEYS.map((key) => (
            <option key={key} value={key} />
          ))}
        </datalist>
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

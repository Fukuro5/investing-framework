"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { checkEdgarUpdatesAction, type CheckEdgarUpdatesState } from "@/app/[locale]/thesis/actions";
import type { FinancialsTrendVerdict } from "@/lib/edgar/compute-financials-trend";
import type { InstrumentEdgarStatus } from "@/lib/edgar/get-instrument-edgar-status";

const INITIAL_STATE: CheckEdgarUpdatesState = { status: "idle" };

const VERDICT_MESSAGE_KEYS: Record<FinancialsTrendVerdict, "edgarVerdictImproving" | "edgarVerdictFlat" | "edgarVerdictDeteriorating"> = {
  improving: "edgarVerdictImproving",
  flat: "edgarVerdictFlat",
  deteriorating: "edgarVerdictDeteriorating",
};

interface IEdgarCheckButtonProps {
  instrumentId: string;
  initialStatus: InstrumentEdgarStatus;
}

export const EdgarCheckButton = ({ instrumentId, initialStatus }: IEdgarCheckButtonProps) => {
  const t = useTranslations("thesisPage");
  const [state, formAction, isPending] = useActionState(checkEdgarUpdatesAction, INITIAL_STATE);

  // "updated" carries a fresh verdict; every other status (including
  // "upToDate"/"error") means nothing changed, so the previously-known
  // status from the page load is still accurate and shouldn't disappear.
  const showsPriorStatus = state.status !== "updated";
  const verdict = state.status === "updated" ? state.verdict : initialStatus.verdict;

  return (
    <form action={formAction} className="flex flex-col gap-2 text-sm">
      <input type="hidden" name="instrumentId" value={instrumentId} />
      {showsPriorStatus && (
        <div className="text-black/60 dark:text-white/60">
          {initialStatus.lastCheckedFilingDate
            ? t("edgarLastChecked", { date: initialStatus.lastCheckedFilingDate.toLocaleDateString() })
            : t("edgarNeverChecked")}
        </div>
      )}
      {verdict && <div className="text-black/60 dark:text-white/60">{t(VERDICT_MESSAGE_KEYS[verdict])}</div>}
      <button
        type="submit"
        disabled={isPending}
        className="w-fit rounded border border-black/20 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/20"
      >
        {t("edgarCheckButton")}
      </button>
      {state.status === "upToDate" && <p className="text-black/60 dark:text-white/60">{t("edgarUpToDate")}</p>}
      {state.status === "error" && <p className="text-red-700 dark:text-red-400">{state.errorMessage}</p>}
    </form>
  );
};

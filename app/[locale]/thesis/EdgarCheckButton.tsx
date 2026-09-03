"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { checkEdgarUpdatesAction, type CheckEdgarUpdatesState } from "@/app/[locale]/thesis/actions";
import type { AiErrorCode } from "@/lib/ai/errors";
import type { ThesisVerdict } from "@/lib/ai/types";
import type { FinancialsTrendVerdict } from "@/lib/edgar/compute-financials-trend";
import type { InstrumentEdgarStatus } from "@/lib/edgar/get-instrument-edgar-status";

const INITIAL_STATE: CheckEdgarUpdatesState = { status: "idle" };

const VERDICT_MESSAGE_KEYS: Record<FinancialsTrendVerdict, "edgarVerdictImproving" | "edgarVerdictFlat" | "edgarVerdictDeteriorating"> = {
  improving: "edgarVerdictImproving",
  flat: "edgarVerdictFlat",
  deteriorating: "edgarVerdictDeteriorating",
};

const THESIS_VERDICT_MESSAGE_KEYS: Record<ThesisVerdict, "thesisVerdictHolding" | "thesisVerdictPartiallyWeakening" | "thesisVerdictBroken"> = {
  holding: "thesisVerdictHolding",
  partiallyWeakening: "thesisVerdictPartiallyWeakening",
  broken: "thesisVerdictBroken",
};

const THESIS_FAILURE_MESSAGE_KEYS: Record<AiErrorCode, "thesisCheckMissingApiKey" | "thesisCheckRequestFailed" | "thesisCheckInvalidResponse"> = {
  missingApiKey: "thesisCheckMissingApiKey",
  requestFailed: "thesisCheckRequestFailed",
  invalidResponse: "thesisCheckInvalidResponse",
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
  const freshThesisCheck = state.status === "updated" ? state.thesisCheck : undefined;
  const thesisVerdict = freshThesisCheck?.status === "assessed" ? freshThesisCheck.verdict : initialStatus.thesisVerdict;
  const thesisExplanation = freshThesisCheck?.status === "assessed" ? freshThesisCheck.explanation : initialStatus.thesisExplanation;

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
      {thesisVerdict && (
        <div className="text-black/60 dark:text-white/60">
          {t(THESIS_VERDICT_MESSAGE_KEYS[thesisVerdict])}
          {thesisExplanation && <span className="block">{thesisExplanation}</span>}
        </div>
      )}
      {freshThesisCheck?.status === "skippedNoThesis" && <p className="text-black/60 dark:text-white/60">{t("thesisCheckSkippedNoThesis")}</p>}
      {freshThesisCheck?.status === "failed" && (
        <p className="text-red-700 dark:text-red-400">{t(THESIS_FAILURE_MESSAGE_KEYS[freshThesisCheck.code])}</p>
      )}
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

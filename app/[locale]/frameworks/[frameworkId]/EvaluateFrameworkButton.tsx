"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { evaluateFrameworkAction, type EvaluateFrameworkState } from "@/app/[locale]/frameworks/[frameworkId]/actions";

const INITIAL_STATE: EvaluateFrameworkState = { status: "idle" };

interface IEvaluateFrameworkButtonProps {
  frameworkId: string;
}

export const EvaluateFrameworkButton = ({ frameworkId }: IEvaluateFrameworkButtonProps) => {
  const t = useTranslations("frameworkDetailPage");
  const [state, formAction, isPending] = useActionState(evaluateFrameworkAction, INITIAL_STATE);

  return (
    <form action={formAction} className="mt-2">
      <input type="hidden" name="frameworkId" value={frameworkId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-black/20 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/20"
      >
        {t("evaluateButton")}
      </button>
      {state.status === "success" && (
        <p className="mt-1 text-sm text-green-700 dark:text-green-400">
          {t("evaluateSuccessMessage", { classifiedCount: state.classifiedCount ?? 0 })}
        </p>
      )}
      {state.status === "error" && <p className="mt-1 text-sm text-red-700 dark:text-red-400">{state.errorMessage}</p>}
    </form>
  );
};

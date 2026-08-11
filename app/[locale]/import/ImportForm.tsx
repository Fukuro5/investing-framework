"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { importStatement, type ImportStatementState } from "@/app/[locale]/import/actions";

const INITIAL_STATE: ImportStatementState = { status: "idle" };

export const ImportForm = () => {
  const t = useTranslations("importPage");
  const tErrors = useTranslations("errors");
  const [state, formAction, isPending] = useActionState(importStatement, INITIAL_STATE);

  return (
    <form action={formAction} className="mt-6 flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        {t("fileLabel")}
        <input
          type="file"
          name="file"
          accept="application/json"
          required
          className="rounded border border-black/20 px-3 py-2 dark:border-white/20"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {t("submitButton")}
      </button>
      {state.status === "success" && (
        <p className="text-sm text-green-700 dark:text-green-400">
          {t("successMessage", {
            transactionCount: state.transactionCount ?? 0,
            positionCount: state.positionCount ?? 0,
          })}
        </p>
      )}
      {state.status === "no-new-transactions" && (
        <p className="text-sm text-black/60 dark:text-white/60">{t("noNewTransactionsMessage")}</p>
      )}
      {state.status === "error" && (
        <p className="text-sm text-red-700 dark:text-red-400">{tErrors(state.errorKey ?? "genericImportError")}</p>
      )}
    </form>
  );
};

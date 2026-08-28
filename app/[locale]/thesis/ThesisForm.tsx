"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { upsertThesisAction, type UpsertThesisState } from "@/app/[locale]/thesis/actions";

const INITIAL_STATE: UpsertThesisState = { status: "idle" };

interface IThesisFormProps {
  instrumentId: string;
  initialContent: string;
}

export const ThesisForm = ({ instrumentId, initialContent }: IThesisFormProps) => {
  const t = useTranslations("thesisPage");
  const [state, formAction, isPending] = useActionState(upsertThesisAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="instrumentId" value={instrumentId} />
      <label className="flex flex-col gap-1 text-sm">
        {t("contentLabel")}
        <textarea
          name="content"
          rows={4}
          defaultValue={initialContent}
          className="w-full max-w-xl rounded border border-black/20 px-2 py-1 dark:border-white/20"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="w-fit rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {t("saveButton")}
      </button>
      {state.status === "error" && <p className="text-sm text-red-700 dark:text-red-400">{state.errorMessage}</p>}
    </form>
  );
};

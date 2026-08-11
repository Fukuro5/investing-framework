"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { updateFrameworkAction, type FormState } from "@/app/[locale]/frameworks/[frameworkId]/actions";

const INITIAL_STATE: FormState = { status: "idle" };

interface IEditFrameworkFormProps {
  frameworkId: string;
  name: string;
  description: string | null;
}

export const EditFrameworkForm = ({ frameworkId, name, description }: IEditFrameworkFormProps) => {
  const t = useTranslations("frameworkDetailPage");
  const [state, formAction, isPending] = useActionState(updateFrameworkAction, INITIAL_STATE);

  return (
    <form action={formAction} className="mt-4 flex max-w-md flex-col gap-3">
      <input type="hidden" name="frameworkId" value={frameworkId} />
      <label className="flex flex-col gap-1 text-sm">
        {t("nameLabel")}
        <input
          type="text"
          name="name"
          required
          defaultValue={name}
          className="rounded border border-black/20 px-3 py-2 dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("descriptionLabel")}
        <textarea
          name="description"
          defaultValue={description ?? ""}
          className="rounded border border-black/20 px-3 py-2 dark:border-white/20"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="w-fit rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {t("saveButton")}
      </button>
      {state.status === "error" && <p className="text-sm text-red-700 dark:text-red-400">{state.errorMessage}</p>}
    </form>
  );
};

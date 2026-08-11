"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { createFrameworkAction, type CreateFrameworkState } from "@/app/[locale]/frameworks/actions";

const INITIAL_STATE: CreateFrameworkState = { status: "idle" };

export const NewFrameworkForm = () => {
  const t = useTranslations("frameworksPage");
  const [state, formAction, isPending] = useActionState(createFrameworkAction, INITIAL_STATE);

  return (
    <form action={formAction} className="mt-4 flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        {t("nameLabel")}
        <input
          type="text"
          name="name"
          required
          className="rounded border border-black/20 px-3 py-2 dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("descriptionLabel")}
        <textarea name="description" className="rounded border border-black/20 px-3 py-2 dark:border-white/20" />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="w-fit rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {t("createButton")}
      </button>
      {state.status === "error" && <p className="text-sm text-red-700 dark:text-red-400">{state.errorMessage}</p>}
    </form>
  );
};

"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { activateFrameworkAction, type ActivateFrameworkState } from "@/app/[locale]/frameworks/actions";

const INITIAL_STATE: ActivateFrameworkState = { status: "idle" };

interface IActivateFrameworkButtonProps {
  frameworkId: string;
}

export const ActivateFrameworkButton = ({ frameworkId }: IActivateFrameworkButtonProps) => {
  const t = useTranslations("frameworksPage");
  const [state, formAction, isPending] = useActionState(activateFrameworkAction, INITIAL_STATE);

  return (
    <form action={formAction}>
      <input type="hidden" name="frameworkId" value={frameworkId} />
      <button type="submit" disabled={isPending} className="text-sm hover:underline disabled:opacity-50">
        {t("activateButton")}
      </button>
      {state.status === "error" && <p className="text-xs text-red-700 dark:text-red-400">{state.errorMessage}</p>}
    </form>
  );
};

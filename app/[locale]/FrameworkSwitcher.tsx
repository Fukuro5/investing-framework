"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { activateFrameworkAction, type ActivateFrameworkState } from "@/app/[locale]/frameworks/actions";
import { Link } from "@/i18n/navigation";

interface IFrameworkSwitcherProps {
  frameworks: { id: string; name: string }[];
  activeFrameworkId: string | null;
}

const INITIAL_STATE: ActivateFrameworkState = { status: "idle" };

export const FrameworkSwitcher = ({ frameworks, activeFrameworkId }: IFrameworkSwitcherProps) => {
  const t = useTranslations("dashboardPage.frameworkSwitcher");
  const [state, formAction, isPending] = useActionState(activateFrameworkAction, INITIAL_STATE);

  if (frameworks.length === 0) {
    return (
      <p className="mt-4 text-sm text-black/60 dark:text-white/60">
        {t("noFrameworks")}{" "}
        <Link href="/frameworks" className="underline">
          {t("manageLink")}
        </Link>
      </p>
    );
  }

  return (
    <div className="mt-4">
      <form action={formAction} className="flex items-center gap-2 text-sm">
        <select
          name="frameworkId"
          defaultValue={activeFrameworkId ?? ""}
          className="rounded border border-black/20 px-2 py-1 dark:border-white/20"
        >
          {!activeFrameworkId && (
            <option value="" disabled>
              {t("selectPlaceholder")}
            </option>
          )}
          {frameworks.map((framework) => (
            <option key={framework.id} value={framework.id}>
              {framework.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="rounded border border-black/20 px-3 py-1 disabled:opacity-50 dark:border-white/20"
        >
          {t("setActiveButton")}
        </button>
        <Link href="/frameworks" className="underline">
          {t("manageLink")}
        </Link>
      </form>
      {state.status === "error" && <p className="mt-1 text-sm text-red-700 dark:text-red-400">{state.errorMessage}</p>}
    </div>
  );
};

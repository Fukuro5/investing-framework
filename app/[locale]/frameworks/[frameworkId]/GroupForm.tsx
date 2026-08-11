"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import type { FormState } from "@/app/[locale]/frameworks/[frameworkId]/actions";

const INITIAL_STATE: FormState = { status: "idle" };

interface IGroupFormDefaults {
  name: string;
  targetAllocationMin: number;
  targetAllocationMax: number;
  priority: number;
}

interface IGroupFormProps {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  hiddenFields: Record<string, string>;
  defaultValues?: IGroupFormDefaults;
  submitLabel: string;
}

export const GroupForm = ({ action, hiddenFields, defaultValues, submitLabel }: IGroupFormProps) => {
  const t = useTranslations("frameworkDetailPage");
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="flex flex-col gap-1 text-sm">
        {t("groupNameLabel")}
        <input
          type="text"
          name="name"
          required
          defaultValue={defaultValues?.name}
          className="rounded border border-black/20 px-2 py-1 dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("groupMinLabel")}
        <input
          type="number"
          name="targetAllocationMin"
          required
          min={0}
          max={100}
          step="0.1"
          defaultValue={defaultValues?.targetAllocationMin}
          className="w-24 rounded border border-black/20 px-2 py-1 dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("groupMaxLabel")}
        <input
          type="number"
          name="targetAllocationMax"
          required
          min={0}
          max={100}
          step="0.1"
          defaultValue={defaultValues?.targetAllocationMax}
          className="w-24 rounded border border-black/20 px-2 py-1 dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("groupPriorityLabel")}
        <input
          type="number"
          name="priority"
          required
          step="1"
          defaultValue={defaultValues?.priority ?? 0}
          className="w-20 rounded border border-black/20 px-2 py-1 dark:border-white/20"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {submitLabel}
      </button>
      {state.status === "error" && <p className="w-full text-sm text-red-700 dark:text-red-400">{state.errorMessage}</p>}
    </form>
  );
};

"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import type { FormState } from "@/app/[locale]/frameworks/[frameworkId]/actions";
import { RULE_OPERATORS } from "@/lib/frameworks/consts";

const INITIAL_STATE: FormState = { status: "idle" };

interface IRuleFormDefaults {
  metricKey: string;
  operator: string;
  threshold: number;
  isActive: boolean;
}

interface IRuleFormProps {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  hiddenFields: Record<string, string>;
  defaultValues?: IRuleFormDefaults;
  submitLabel: string;
}

export const RuleForm = ({ action, hiddenFields, defaultValues, submitLabel }: IRuleFormProps) => {
  const t = useTranslations("frameworkDetailPage");
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="flex flex-col gap-1 text-sm">
        {t("ruleMetricKeyLabel")}
        <input
          type="text"
          name="metricKey"
          required
          defaultValue={defaultValues?.metricKey}
          className="w-28 rounded border border-black/20 px-2 py-1 dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("ruleOperatorLabel")}
        <select
          name="operator"
          defaultValue={defaultValues?.operator ?? RULE_OPERATORS[0]}
          className="rounded border border-black/20 px-2 py-1 dark:border-white/20"
        >
          {RULE_OPERATORS.map((operator) => (
            <option key={operator} value={operator}>
              {t(`ruleOperators.${operator}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("ruleThresholdLabel")}
        <input
          type="number"
          name="threshold"
          required
          step="0.01"
          defaultValue={defaultValues?.threshold}
          className="w-24 rounded border border-black/20 px-2 py-1 dark:border-white/20"
        />
      </label>
      {defaultValues && (
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={defaultValues.isActive} />
          {t("ruleActiveLabel")}
        </label>
      )}
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

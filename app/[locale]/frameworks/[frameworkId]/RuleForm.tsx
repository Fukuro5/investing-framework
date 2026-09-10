"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import type { FormState } from "@/app/[locale]/frameworks/[frameworkId]/actions";
import { isRuleType, RULE_OPERATORS, RULE_TYPES } from "@/lib/frameworks/consts";
import { METRIC_KEYS } from "@/lib/metrics/catalog";

const INITIAL_STATE: FormState = { status: "idle" };

type RuleType = (typeof RULE_TYPES)[number];

interface IRuleFormDefaults {
  type: RuleType;
  metricKey: string | null;
  operator: string | null;
  threshold: number | null;
  minAllocation: number | null;
  maxAllocation: number | null;
  isActive: boolean;
}

interface IRuleFormProps {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  hiddenFields: Record<string, string>;
  defaultValues?: IRuleFormDefaults;
  submitLabel: string;
}

// Creating a new rule via this form always produces either a metric rule
// or a position-scoped allocation rule — a group's own scope='group'
// allocation band is managed by GroupForm instead (PLANNING.md §1 Phase 1).
export const RuleForm = ({ action, hiddenFields, defaultValues, submitLabel }: IRuleFormProps) => {
  const t = useTranslations("frameworkDetailPage");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [type, setType] = useState<RuleType>(defaultValues?.type ?? "metric");

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {defaultValues ? (
        <input type="hidden" name="type" value={defaultValues.type} />
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          {t("ruleTypeLabel")}
          <select
            name="type"
            value={type}
            onChange={(event) => {
              if (isRuleType(event.target.value)) {
                setType(event.target.value);
              }
            }}
            className="rounded border border-black/20 px-2 py-1 dark:border-white/20"
          >
            {RULE_TYPES.map((ruleType) => (
              <option key={ruleType} value={ruleType}>
                {t(`ruleTypes.${ruleType}`)}
              </option>
            ))}
          </select>
        </label>
      )}

      {type === "metric" ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            {t("ruleMetricKeyLabel")}
            <select
              name="metricKey"
              required
              defaultValue={defaultValues?.metricKey ?? ""}
              className="rounded border border-black/20 px-2 py-1 dark:border-white/20"
            >
              <option value="" disabled>
                {t("ruleMetricKeyPlaceholder")}
              </option>
              {METRIC_KEYS.map((metricKey) => (
                <option key={metricKey} value={metricKey}>
                  {tCommon(`metricKeys.${metricKey}`)}
                </option>
              ))}
            </select>
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
              defaultValue={defaultValues?.threshold ?? undefined}
              className="w-24 rounded border border-black/20 px-2 py-1 dark:border-white/20"
            />
          </label>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            {t("ruleMinAllocationLabel")}
            <input
              type="number"
              name="minAllocation"
              required
              min={0}
              max={100}
              step="0.1"
              defaultValue={defaultValues?.minAllocation ?? undefined}
              className="w-24 rounded border border-black/20 px-2 py-1 dark:border-white/20"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("ruleMaxAllocationLabel")}
            <input
              type="number"
              name="maxAllocation"
              required
              min={0}
              max={100}
              step="0.1"
              defaultValue={defaultValues?.maxAllocation ?? undefined}
              className="w-24 rounded border border-black/20 px-2 py-1 dark:border-white/20"
            />
          </label>
        </>
      )}

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

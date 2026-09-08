import { useTranslations } from "next-intl";
import type { SignalBadge } from "@/lib/signals/compute-position-signal";
import type { PositionSignalView } from "@/lib/signals/get-active-framework-position-signals";

interface IPositionSignalCellProps {
  signal: PositionSignalView | null;
  locale: string;
}

const BADGE_CLASS_NAMES: Record<SignalBadge, string> = {
  sell: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  trim: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  hold: "bg-black/5 text-black/70 dark:bg-white/10 dark:text-white/70",
  buyMore: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

const formatPercent = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value / 100);

export const PositionSignalCell = ({ signal, locale }: IPositionSignalCellProps) => {
  const t = useTranslations("dashboardPage.signal");
  const tCommon = useTranslations("dashboardPage");

  if (!signal) {
    return <span className="text-black/40 dark:text-white/40">{t("unclassified")}</span>;
  }

  const thesisLine = signal.thesisVerdict
    ? [t(`thesisVerdicts.${signal.thesisVerdict}`), signal.thesisExplanation].filter(Boolean).join(" — ")
    : t("thesisVerdicts.notChecked");

  const metricsLine =
    signal.totalSignalMetricRuleCount === 0
      ? t("metricsNotConfigured")
      : t("metricsSummary", { underperforming: signal.underperformingMetricKeys.length, total: signal.totalSignalMetricRuleCount });

  const allocationLine = signal.allocationBand
    ? t("allocationSummary", {
        current: signal.allocationPercent === null ? tCommon("unavailable") : formatPercent(signal.allocationPercent, locale),
        min: formatPercent(signal.allocationBand.minAllocation, locale),
        max: formatPercent(signal.allocationBand.maxAllocation, locale),
      })
    : t("allocationNoBand");

  return (
    <details>
      <summary className={`inline-block cursor-pointer rounded px-2 py-0.5 text-xs font-medium ${BADGE_CLASS_NAMES[signal.badge]}`}>
        {t(`badges.${signal.badge}`)}
      </summary>
      <ul className="mt-2 max-w-xs list-disc space-y-1 pl-4 text-xs text-black/70 dark:text-white/70">
        <li>{thesisLine}</li>
        <li>{metricsLine}</li>
        <li>{allocationLine}</li>
      </ul>
    </details>
  );
};

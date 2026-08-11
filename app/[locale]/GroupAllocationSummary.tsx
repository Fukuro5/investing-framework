import { getTranslations } from "next-intl/server";
import type { ActiveFrameworkAllocations } from "@/lib/frameworks/get-group-allocations";

interface IGroupAllocationSummaryProps {
  allocations: ActiveFrameworkAllocations;
  locale: string;
}

const formatPercent = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value / 100);

export const GroupAllocationSummary = async ({ allocations, locale }: IGroupAllocationSummaryProps) => {
  const t = await getTranslations("dashboardPage.groupAllocations");

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold">{t("title", { frameworkName: allocations.framework.name })}</h2>
      <table className="mt-2 w-full max-w-2xl text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10">
            <th className="py-2 pr-4 font-medium">{t("columns.group")}</th>
            <th className="py-2 pr-4 font-medium">{t("columns.target")}</th>
            <th className="py-2 font-medium">{t("columns.current")}</th>
          </tr>
        </thead>
        <tbody>
          {allocations.groups.map((group) => {
            const isOutsideTarget =
              group.currentAllocationPercent < group.targetAllocationMin ||
              group.currentAllocationPercent > group.targetAllocationMax;
            const statusClassName = isOutsideTarget
              ? "text-amber-700 dark:text-amber-400"
              : "text-green-700 dark:text-green-400";

            return (
              <tr key={group.groupId} className="border-b border-black/5 dark:border-white/5">
                <td className="py-2 pr-4">{group.name}</td>
                <td className="py-2 pr-4">
                  {formatPercent(group.targetAllocationMin, locale)}–{formatPercent(group.targetAllocationMax, locale)}
                </td>
                <td className={`py-2 ${statusClassName}`}>{formatPercent(group.currentAllocationPercent, locale)}</td>
              </tr>
            );
          })}
          <tr>
            <td className="py-2 pr-4 text-black/60 dark:text-white/60">{t("unclassifiedLabel")}</td>
            <td className="py-2 pr-4" />
            <td className="py-2 text-black/60 dark:text-white/60">
              {formatPercent(allocations.unclassifiedAllocationPercent, locale)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

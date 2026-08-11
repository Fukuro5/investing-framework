import { useTranslations } from "next-intl";
import type { PositionView } from "@/lib/dashboard/types";

interface IPositionsTableProps {
  positions: PositionView[];
  locale: string;
}

const formatMoney = (value: number | null, currency: string, locale: string): string | null =>
  value === null ? null : new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);

const formatPercent = (value: number | null, locale: string): string | null =>
  value === null ? null : new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value / 100);

const formatDateTime = (value: Date | null, locale: string): string | null =>
  value === null ? null : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(value);

export const PositionsTable = ({ positions, locale }: IPositionsTableProps) => {
  const t = useTranslations("dashboardPage");

  if (positions.length === 0) {
    return <p className="mt-2 text-sm text-black/60 dark:text-white/60">{t("emptyState")}</p>;
  }

  return (
    <table className="mt-6 w-full text-left text-sm">
      <thead>
        <tr className="border-b border-black/10 dark:border-white/10">
          <th className="py-2 pr-4 font-medium">{t("columns.instrument")}</th>
          <th className="py-2 pr-4 font-medium">{t("columns.quantity")}</th>
          <th className="py-2 pr-4 font-medium">{t("columns.avgCost")}</th>
          <th className="py-2 pr-4 font-medium">{t("columns.currentPrice")}</th>
          <th className="py-2 pr-4 font-medium">{t("columns.priceAsOf")}</th>
          <th className="py-2 pr-4 font-medium">{t("columns.marketValue")}</th>
          <th className="py-2 pr-4 font-medium">{t("columns.allocation")}</th>
          <th className="py-2 font-medium">{t("columns.unrealizedPnl")}</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((position) => (
          <tr key={`${position.accountId}-${position.instrumentId}`} className="border-b border-black/5 dark:border-white/5">
            <td className="py-2 pr-4">
              <div className="font-medium">{position.ticker}</div>
              <div className="text-black/60 dark:text-white/60">{position.name}</div>
            </td>
            <td className="py-2 pr-4">{position.quantity}</td>
            <td className="py-2 pr-4">{formatMoney(position.avgCostPrice, position.currency, locale)}</td>
            <td className="py-2 pr-4">{formatMoney(position.marketPrice, position.currency, locale) ?? t("unavailable")}</td>
            <td className="py-2 pr-4 text-black/60 dark:text-white/60">
              {formatDateTime(position.marketPriceAsOf, locale) ?? t("unavailable")}
            </td>
            <td className="py-2 pr-4">{formatMoney(position.marketValue, position.currency, locale) ?? t("unavailable")}</td>
            <td className="py-2 pr-4">{formatPercent(position.allocationPercent, locale) ?? t("unavailable")}</td>
            <td className="py-2">{formatMoney(position.unrealizedPnl, position.currency, locale) ?? t("unavailable")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

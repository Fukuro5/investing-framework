import { getTranslations } from "next-intl/server";
import { ManualMetricForm } from "@/app/[locale]/metrics/ManualMetricForm";
import { getPositions } from "@/lib/dashboard/get-positions";
import { listInstrumentMetrics } from "@/lib/metrics/list-instrument-metrics";

const MetricsPage = async () => {
  const t = await getTranslations("metricsPage");
  const positions = await getPositions();
  const metricsByInstrumentId = new Map(
    await Promise.all(positions.map(async (position) => [position.instrumentId, await listInstrumentMetrics(position.instrumentId)] as const)),
  );

  return (
    <div className="px-6 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">{t("description")}</p>

      {positions.length === 0 ? (
        <p className="mt-6 text-sm text-black/60 dark:text-white/60">{t("noPositions")}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-6">
          {positions.map((position) => {
            const metrics = metricsByInstrumentId.get(position.instrumentId) ?? [];

            return (
              <li key={position.instrumentId} className="rounded border border-black/10 p-4 dark:border-white/10">
                <h2 className="font-medium">
                  {position.ticker} <span className="text-black/60 dark:text-white/60">{position.name}</span>
                </h2>

                {metrics.length > 0 && (
                  <table className="mt-3 w-full max-w-xl text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/10 dark:border-white/10">
                        <th className="py-1 pr-4 font-medium">{t("columns.metricKey")}</th>
                        <th className="py-1 pr-4 font-medium">{t("columns.value")}</th>
                        <th className="py-1 pr-4 font-medium">{t("columns.asOfDate")}</th>
                        <th className="py-1 font-medium">{t("columns.source")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map((metric) => (
                        <tr
                          key={`${metric.metricKey}-${metric.source}-${metric.asOfDate.toISOString()}`}
                          className={`border-b border-black/5 dark:border-white/5 ${metric.isCurrent ? "font-medium" : "text-black/60 dark:text-white/60"}`}
                        >
                          <td className="py-1 pr-4">{metric.metricKey}</td>
                          <td className="py-1 pr-4">{metric.value}</td>
                          <td className="py-1 pr-4">{metric.asOfDate.toLocaleDateString()}</td>
                          <td className="py-1">{metric.source === "manual" ? t("sourceManual") : t("sourceApi")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="mt-3">
                  <ManualMetricForm instrumentId={position.instrumentId} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default MetricsPage;

import { getTranslations } from "next-intl/server";
import { MetricError } from "@/lib/metrics/errors";

// Mirrors lib/frameworks/resolve-error-message.ts.
export const resolveMetricErrorMessage = async (error: unknown): Promise<string> => {
  const t = await getTranslations("errors.metrics");

  if (error instanceof MetricError) {
    return t(error.code);
  }

  return t("generic");
};

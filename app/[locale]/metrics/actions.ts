"use server";

import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MetricError } from "@/lib/metrics/errors";
import { resolveMetricErrorMessage } from "@/lib/metrics/resolve-error-message";
import { upsertManualMetric } from "@/lib/metrics/upsert-manual-metric";

export interface UpsertMetricState {
  status: "idle" | "error";
  errorMessage?: string;
}

export const upsertManualMetricAction = async (
  _previousState: UpsertMetricState,
  formData: FormData,
  db: PrismaClient = prisma,
): Promise<UpsertMetricState> => {
  try {
    const asOfDateRaw = String(formData.get("asOfDate") ?? "");
    const asOfDate = new Date(asOfDateRaw);
    if (Number.isNaN(asOfDate.getTime())) {
      throw new MetricError("metricAsOfDateInvalid", `"${asOfDateRaw}" is not a valid date`);
    }

    const value = Number(formData.get("value"));
    if (Number.isNaN(value)) {
      throw new MetricError("metricValueMustBeNumber", "Metric value must be a number");
    }

    await upsertManualMetric(
      { instrumentId: String(formData.get("instrumentId") ?? ""), metricKey: String(formData.get("metricKey") ?? ""), value, asOfDate },
      db,
    );
  } catch (error) {
    return { status: "error", errorMessage: await resolveMetricErrorMessage(error) };
  }

  return { status: "idle" };
};

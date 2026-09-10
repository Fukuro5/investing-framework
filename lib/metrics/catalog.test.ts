import { describe, expect, it } from "vitest";
import { isMetricKey, KEY_METRICS_TTM_METRIC_FIELDS, METRIC_KEYS, RATIOS_TTM_METRIC_FIELDS } from "@/lib/metrics/catalog";

describe("isMetricKey", () => {
  it("accepts every key in the catalog", () => {
    for (const key of METRIC_KEYS) {
      expect(isMetricKey(key)).toBe(true);
    }
  });

  it("rejects a key not in the catalog", () => {
    expect(isMetricKey("notARealMetric")).toBe(false);
  });
});

describe("METRIC_KEYS field mapping coverage", () => {
  it("maps every catalog key to exactly one FMP endpoint field", () => {
    for (const key of METRIC_KEYS) {
      const inRatios = key in RATIOS_TTM_METRIC_FIELDS;
      const inKeyMetrics = key in KEY_METRICS_TTM_METRIC_FIELDS;

      expect(inRatios !== inKeyMetrics).toBe(true);
    }
  });
});

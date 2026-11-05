import test from "node:test";
import assert from "node:assert/strict";
import { calculateCampaignMetrics, parseCampaignMetric } from "../lib/campaign-metrics.mjs";

test("parses Persian and Arabic digits, grouping separators, and decimals", () => {
  assert.equal(parseCampaignMetric("۱۲٬۳۴۵"), 12345);
  assert.equal(parseCampaignMetric("١٢٣٫٥٠"), 123.5);
  assert.equal(parseCampaignMetric("1,234.50"), 1234.5);
});

test("rejects negative, malformed, and fractional count metrics", () => {
  assert.equal(parseCampaignMetric("-12"), null);
  assert.equal(parseCampaignMetric("12.345"), null);
  assert.equal(parseCampaignMetric("12.5", { integer: true }), null);
  assert.equal(parseCampaignMetric("abc"), null);
});

test("calculates campaign KPIs without dividing by zero", () => {
  assert.deepEqual(
    calculateCampaignMetrics({
      impressions: 10000,
      clicks: 500,
      leads: 50,
      conversions: 20,
      spend: 1000,
      revenue: 3500,
    }),
    { ctr: 5, cpl: 20, cpa: 50, conversionRate: 4, roas: 3.5 }
  );
  assert.deepEqual(
    calculateCampaignMetrics(),
    { ctr: null, cpl: null, cpa: null, conversionRate: null, roas: null }
  );
});

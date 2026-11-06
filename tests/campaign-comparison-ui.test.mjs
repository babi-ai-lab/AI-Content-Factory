import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildCampaignComparisonCsv } from "../lib/campaign-metrics.mjs";

test("campaign manager supports comparing up to four campaigns across key performance metrics", async () => {
  const source = await readFile(new URL("../components/campaign-manager.tsx", import.meta.url), "utf8");
  assert.match(source, /selectedComparisonIds/);
  assert.match(source, /حداکثر ۴ کمپین/);
  assert.match(source, /campaign-comparison-table/);
  assert.match(source, /calculateCampaignMetrics/);
  assert.match(source, /نرخ کلیک \(CTR\)/);
  assert.match(source, /هزینه هر سرنخ \(CPL\)/);
  assert.match(source, /بازده هزینه تبلیغ \(ROAS\)/);
  assert.match(source, /مصرف بودجه/);
  assert.match(source, /تبدیل/);
  assert.match(source, /exportCampaignComparisonCsv/);
  assert.match(source, /text\/csv;charset=utf-8/);
  assert.match(source, /buildCampaignComparisonCsv/);
  assert.match(source, /دریافت فایل CSV/);
  assert.match(source, /aria-label="مقایسه شاخص‌های عملکرد کمپین‌ها"/);
});

test("builds an Excel-friendly Persian CSV and escapes quotes and delimiters", () => {
  const csv = buildCampaignComparisonCsv(
    ["شاخص", "کمپین، اول"],
    [["یادداشت", 'متن با "نقل قول"'], ["هزینه", 1200]],
  );
  assert.equal(
    csv,
    '\uFEFF"شاخص","کمپین، اول"\r\n"یادداشت","متن با ""نقل قول"""\r\n"هزینه","1200"',
  );
});
